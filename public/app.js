/**
 * fruit-chat · app.js
 * Full chat logic: SSE streaming, conversation management, markdown, localStorage
 */

// ─── State ───────────────────────────────────────────────────────────────────

const STORAGE_KEY  = 'fruitchat_convs';
const SETTINGS_KEY = 'fruitchat_settings';
const THEME_KEY    = 'fruitchat_theme';   // 'dark' | 'light' | 'system'
const MODEL = 'apple-foundationmodel';

let conversations = loadConvs();
let activeConvId = null;
let isStreaming = false;

let settings = loadSettings();

// ─── DOM References ──────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const ui = {
  sidebar:         $('sidebar'),
  sidebarOpenBtn:  $('sidebar-open-btn'),
  sidebarCloseBtn: $('sidebar-close-btn'),
  convList:        $('conv-list'),
  newChatBtn:      $('new-chat-btn'),
  messages:        $('messages'),
  welcomeState:    $('welcome-state'),
  messageInput:    $('message-input'),
  sendBtn:         $('send-btn'),
  clearChatBtn:    $('clear-chat-btn'),
  topbarTitle:     $('topbar-title'),
  statusPill:      $('status-pill'),
  statusDot:       $('status-dot'),
  statusText:      $('status-text'),
  charCount:       $('char-count'),
  settingsToggle:  $('settings-toggle-btn'),
  settingsPanel:   $('settings-panel'),
  settingsClose:   $('settings-close-btn'),
  systemPrompt:    $('system-prompt-input'),
  maxTokens:       $('max-tokens-input'),
  tempSlider:      $('temp-slider'),
  tempVal:         $('temp-val'),
  saveSettings:    $('save-settings-btn'),
  loadingOverlay:  $('model-loading-overlay'),
  themeToggle:     $('theme-toggle-btn'),
};

// ─── Init ────────────────────────────────────────────────────────────────────

function init() {
  initTheme();         // Apply saved theme before anything renders
  applySettings();
  renderConvList();
  bindEvents();
  checkStatus();
  setInterval(checkStatus, 30000);

  // Load last active conv or create new
  if (conversations.length > 0) {
    loadConv(conversations[0].id);
  } else {
    newConversation();
  }
}

// ─── Status Check ─────────────────────────────────────────────────────────────

async function checkStatus() {
  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      setStatus('online', 'Apple Intelligence Ready');
    } else {
      const data = await res.json().catch(() => ({}));
      setStatus('offline', data.message || 'apfel not running');
    }
  } catch {
    setStatus('offline', 'Server offline');
  }
}

function setStatus(state, text) {
  ui.statusPill.className = `status-pill ${state}`;
  ui.statusText.textContent = text;
}

// ─── Event Bindings ───────────────────────────────────────────────────────────

function bindEvents() {
  // Sidebar
  ui.sidebarOpenBtn.addEventListener('click', () => ui.sidebar.classList.add('open'));
  ui.sidebarCloseBtn.addEventListener('click', () => ui.sidebar.classList.remove('open'));

  // New chat
  ui.newChatBtn.addEventListener('click', () => {
    newConversation();
    ui.sidebar.classList.remove('open');
  });

  // Clear chat
  ui.clearChatBtn.addEventListener('click', () => {
    if (activeConvId) {
      const conv = getConv(activeConvId);
      if (conv) {
        conv.messages = [];
        conv.title = 'New Conversation';
        saveConvs();
        renderConvList();
        renderMessages();
      }
    }
  });

  // Send message
  ui.sendBtn.addEventListener('click', sendMessage);

  // Textarea: Enter to send, Shift+Enter for newline
  ui.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming) sendMessage();
    }
  });

  // Auto-resize textarea
  ui.messageInput.addEventListener('input', () => {
    autoResizeTextarea();
    updateSendBtn();
    updateCharCount();
  });

  // Settings
  ui.settingsToggle.addEventListener('click', () => {
    const hidden = ui.settingsPanel.hidden;
    ui.settingsPanel.hidden = !hidden;
    ui.settingsToggle.setAttribute('aria-expanded', hidden ? 'true' : 'false');
  });
  ui.settingsClose.addEventListener('click', () => {
    ui.settingsPanel.hidden = true;
    ui.settingsToggle.setAttribute('aria-expanded', 'false');
  });

  ui.tempSlider.addEventListener('input', () => {
    ui.tempVal.textContent = ui.tempSlider.value;
  });

  ui.saveSettings.addEventListener('click', () => {
    settings.systemPrompt = ui.systemPrompt.value.trim();
    settings.maxTokens = parseInt(ui.maxTokens.value) || 2048;
    settings.temperature = parseFloat(ui.tempSlider.value);
    saveSettings_();
    ui.settingsPanel.hidden = true;
    ui.settingsToggle.setAttribute('aria-expanded', 'false');
    showToast('Settings saved');
  });

  // Theme toggle
  ui.themeToggle.addEventListener('click', cycleTheme);

  // Welcome chips
  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const prompt = chip.dataset.prompt;
      if (prompt) {
        ui.messageInput.value = prompt;
        autoResizeTextarea();
        updateSendBtn();
        sendMessage();
      }
    });
  });

  // Close settings when clicking outside
  document.addEventListener('click', (e) => {
    if (!ui.settingsPanel.hidden &&
        !ui.settingsPanel.contains(e.target) &&
        !ui.settingsToggle.contains(e.target)) {
      ui.settingsPanel.hidden = true;
    }
  });
}

// ─── Conversation Management ─────────────────────────────────────────────────

function newConversation() {
  const conv = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    title: 'New Conversation',
    messages: [],
    createdAt: Date.now(),
  };
  conversations.unshift(conv);
  saveConvs();
  loadConv(conv.id);
  renderConvList();
  ui.messageInput.focus();
}

function loadConv(id) {
  activeConvId = id;
  renderConvList();
  renderMessages();
  const conv = getConv(id);
  ui.topbarTitle.textContent = conv ? conv.title : 'New Conversation';
}

function deleteConv(id) {
  conversations = conversations.filter((c) => c.id !== id);
  saveConvs();
  if (activeConvId === id) {
    if (conversations.length > 0) {
      loadConv(conversations[0].id);
    } else {
      newConversation();
    }
  }
  renderConvList();
}

function getConv(id) {
  return conversations.find((c) => c.id === id) || null;
}

function generateTitle(text) {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length > 45 ? t.slice(0, 42) + '…' : t;
}

// ─── Render Conversation List ─────────────────────────────────────────────────

function renderConvList() {
  ui.convList.innerHTML = '';
  if (conversations.length === 0) {
    ui.convList.innerHTML = '<div style="font-size:12px;color:var(--text-tertiary);padding:8px 12px;">No conversations yet</div>';
    return;
  }
  conversations.forEach((conv) => {
    const item = document.createElement('div');
    item.className = `conv-item${conv.id === activeConvId ? ' active' : ''}`;
    item.setAttribute('role', 'listitem');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', conv.title);

    const title = document.createElement('div');
    title.className = 'conv-item-title';
    title.textContent = conv.title;

    const del = document.createElement('button');
    del.className = 'conv-item-del btn-icon';
    del.setAttribute('aria-label', 'Delete conversation');
    del.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteConv(conv.id);
    });

    item.append(title, del);
    item.addEventListener('click', () => {
      loadConv(conv.id);
      ui.sidebar.classList.remove('open');
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        loadConv(conv.id);
        ui.sidebar.classList.remove('open');
      }
    });
    ui.convList.appendChild(item);
  });
}

// ─── Render Messages ─────────────────────────────────────────────────────────

function renderMessages() {
  const conv = getConv(activeConvId);
  if (!conv) return;

  // Remove all message nodes (keep welcome state)
  Array.from(ui.messages.children).forEach((el) => {
    if (!el.classList.contains('welcome-state')) el.remove();
  });

  const hasMessages = conv.messages.length > 0;
  ui.welcomeState.hidden = hasMessages;

  if (hasMessages) {
    conv.messages.forEach((msg) => {
      const el = buildMessageEl(msg.role, msg.content);
      ui.messages.appendChild(el);
    });
    scrollToBottom();
  }
}

// ─── Build Message Element ────────────────────────────────────────────────────

function buildMessageEl(role, content, streaming = false) {
  const wrap = document.createElement('div');
  wrap.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = role === 'user' ? '👤' : '🍎';

  const contentWrap = document.createElement('div');
  contentWrap.className = 'message-content';

  const roleDivider = document.createElement('div');
  roleDivider.className = 'message-role';
  roleDivider.textContent = role === 'user' ? 'You' : 'Apple Intelligence';

  const textEl = document.createElement('div');
  textEl.className = 'message-text';
  if (streaming) {
    textEl.innerHTML = '<span class="cursor-blink"></span>';
  } else {
    textEl.innerHTML = renderMarkdown(content);
  }

  contentWrap.append(roleDivider, textEl);

  // Copy action (only for complete messages)
  if (!streaming && role === 'assistant') {
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-action';
    copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(content).then(() => {
        copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
        setTimeout(() => {
          copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
        }, 2000);
      });
    });
    actions.appendChild(copyBtn);
    contentWrap.appendChild(actions);
  }

  wrap.append(avatar, contentWrap);
  return wrap;
}

// ─── Send Message ─────────────────────────────────────────────────────────────

async function sendMessage() {
  const text = ui.messageInput.value.trim();
  if (!text || isStreaming) return;

  const conv = getConv(activeConvId);
  if (!conv) return;

  // Hide welcome state
  ui.welcomeState.hidden = true;

  // Add user message
  const userMsg = { role: 'user', content: text };
  conv.messages.push(userMsg);
  if (conv.title === 'New Conversation') {
    conv.title = generateTitle(text);
    ui.topbarTitle.textContent = conv.title;
  }
  saveConvs();
  renderConvList();

  // Render user bubble
  const userEl = buildMessageEl('user', text);
  ui.messages.appendChild(userEl);

  // Clear input
  ui.messageInput.value = '';
  autoResizeTextarea();
  updateSendBtn();
  updateCharCount();

  // Create assistant bubble
  const assistantEl = buildMessageEl('assistant', '', true);
  ui.messages.appendChild(assistantEl);
  const textEl = assistantEl.querySelector('.message-text');
  scrollToBottom();

  setStreaming(true);

  // Build messages array for API
  const apiMessages = buildApiMessages(conv.messages); // conv.messages has no assistant placeholder yet

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: apiMessages,
        max_tokens: settings.maxTokens,
        temperature: settings.temperature,
        ...(settings.systemPrompt ? { system: settings.systemPrompt } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep partial line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6));

            // Check for error in stream
            if (json.error) {
              throw new Error(json.error);
            }

            // OpenAI SSE delta
            const delta = json?.choices?.[0]?.delta?.content || '';
            if (delta) {
              accumulated += delta;
              // Render with cursor
              textEl.innerHTML = renderMarkdown(accumulated) + '<span class="cursor-blink"></span>';
              scrollToBottom();
            }
          } catch (parseErr) {
            if (parseErr.message !== 'Unexpected end of JSON input') {
              // Real error
              if (parseErr.message.includes('Cannot connect') || parseErr.message.includes('apfel')) {
                throw parseErr;
              }
            }
          }
        }
      }
    }

    // Finalize
    textEl.innerHTML = renderMarkdown(accumulated || '(no response)');

    // Add copy button
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-action';
    copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(accumulated).then(() => {
        copyBtn.textContent = '✓ Copied';
        setTimeout(() => { copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`; }, 2000);
      });
    });
    actions.appendChild(copyBtn);
    assistantEl.querySelector('.message-content').appendChild(actions);

    // Save assistant message
    conv.messages.push({ role: 'assistant', content: accumulated });
    saveConvs();

  } catch (err) {
    textEl.innerHTML = `<div class="message-error">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      ${escapeHtml(err.message)}
    </div>`;
    // Remove the failed placeholder from conv
  } finally {
    setStreaming(false);
    scrollToBottom();
  }
}

function buildApiMessages(messages) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

// ─── Markdown Renderer ────────────────────────────────────────────────────────

function renderMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="lang-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr>');

  // Unordered list
  html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>(\n|$))+/g, (m) => `<ul>${m}</ul>`);

  // Ordered list
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Paragraphs — wrap blocks separated by blank lines
  html = html.split('\n\n').map((para) => {
    const trimmed = para.trim();
    if (!trimmed) return '';
    if (/^<(h[1-6]|ul|ol|li|pre|blockquote|hr)/.test(trimmed)) return trimmed;
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return html;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function setStreaming(val) {
  isStreaming = val;
  ui.sendBtn.disabled = val;
  if (val) {
    ui.sendBtn.classList.add('loading');
  } else {
    ui.sendBtn.classList.remove('loading');
    ui.messageInput.focus();
  }
}

function scrollToBottom() {
  const wrapper = document.querySelector('.messages-wrapper');
  wrapper.scrollTo({ top: wrapper.scrollHeight, behavior: 'smooth' });
}

function autoResizeTextarea() {
  ui.messageInput.style.height = 'auto';
  ui.messageInput.style.height = Math.min(ui.messageInput.scrollHeight, 200) + 'px';
}

function updateSendBtn() {
  ui.sendBtn.disabled = !ui.messageInput.value.trim() || isStreaming;
}

function updateCharCount() {
  const len = ui.messageInput.value.length;
  ui.charCount.textContent = len > 0 ? `${len} chars` : '';
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: rgba(30,30,50,0.95); border: 1px solid rgba(110,127,243,0.3);
    color: white; padding: 10px 20px; border-radius: 100px;
    font-size: 13px; font-weight: 500; z-index: 999;
    animation: fade-in 0.2s ease forwards;
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// ─── Settings Persistence ──────────────────────────────────────────────────────

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { systemPrompt: '', maxTokens: 2048, temperature: 0.7 };
  } catch {
    return { systemPrompt: '', maxTokens: 2048, temperature: 0.7 };
  }
}

function saveSettings_() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function applySettings() {
  ui.systemPrompt.value = settings.systemPrompt || '';
  ui.maxTokens.value = settings.maxTokens || 2048;
  ui.tempSlider.value = settings.temperature !== undefined ? settings.temperature : 0.7;
  ui.tempVal.textContent = ui.tempSlider.value;
}

// ─── Conversation Persistence ──────────────────────────────────────────────────

function loadConvs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConvs() {
  // Trim to 50 conversations max
  if (conversations.length > 50) conversations = conversations.slice(0, 50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

// ─── Theme Management ────────────────────────────────────────────────────────

// Themes cycle: system → dark → light → system
const THEME_CYCLE = ['system', 'dark', 'light'];

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY) || 'system';
  applyTheme(stored);

  // Listen for system preference changes (affects 'system' mode)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((localStorage.getItem(THEME_KEY) || 'system') === 'system') {
      applyTheme('system');
    }
  });
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.dataset.theme = 'dark';
  } else if (theme === 'light') {
    root.dataset.theme = 'light';
  } else {
    // 'system' — remove explicit attribute, let CSS media query decide
    delete root.dataset.theme;
  }

  localStorage.setItem(THEME_KEY, theme);
  updateThemeBtn(theme);
  updateMetaThemeColor(theme);
}

function cycleTheme() {
  const current = localStorage.getItem(THEME_KEY) || 'system';
  const idx = THEME_CYCLE.indexOf(current);
  const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
  applyTheme(next);

  const labels = { system: 'Auto (system)', dark: 'Dark mode', light: 'Light mode' };
  showToast(labels[next]);
}

function updateThemeBtn(theme) {
  if (!ui.themeToggle) return;
  const labels = { system: 'Theme: Auto', dark: 'Theme: Dark', light: 'Theme: Light' };
  ui.themeToggle.title = labels[theme] || 'Toggle theme';
  ui.themeToggle.setAttribute('aria-label', labels[theme] || 'Toggle theme');
}

function updateMetaThemeColor(theme) {
  const isDark = theme === 'dark' || (
    theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = isDark ? '#08080f' : '#f0f0f8';
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
