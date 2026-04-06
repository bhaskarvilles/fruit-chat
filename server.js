/**
 * fruit-chat server.js
 * Serves the web UI and proxies streaming chat requests to apfel (Apple Intelligence)
 * apfel API: http://127.0.0.1:11434/v1 (OpenAI-compatible)
 * NOTE: apfel binds to 127.0.0.1 (IPv4 only). Using 'localhost' can resolve to
 *       ::1 (IPv6) on macOS, causing "socket hang up". Always use 127.0.0.1.
 */

const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4321;
const APFEL_HOST = '127.0.0.1';
const APFEL_PORT = 11434;
const APFEL_BASE = process.env.APFEL_BASE || `http://${APFEL_HOST}:${APFEL_PORT}`;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Health / status ────────────────────────────────────────────────────────

app.get('/api/status', async (req, res) => {
  try {
    const result = await fetchApfel('/health', { method: 'GET' });
    res.json({ ok: true, message: 'Apple Intelligence is ready', apfel: result });
  } catch (err) {
    res.status(503).json({ ok: false, message: err.message });
  }
});

// ─── Models list ─────────────────────────────────────────────────────────────

app.get('/api/models', async (req, res) => {
  try {
    const result = await fetchApfel('/v1/models', { method: 'GET' });
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// ─── Chat completions (streaming + non-streaming) ────────────────────────────

app.post('/api/chat', (req, res) => {
  const body = req.body;

  // Always request streaming from apfel so we can forward SSE to browser
  const payload = JSON.stringify({
    model: 'apple-foundationmodel',
    messages: body.messages || [],
    stream: true,
    max_tokens: body.max_tokens || 2048,
    temperature: body.temperature !== undefined ? body.temperature : 0.7,
    ...(body.system ? { system: body.system } : {}),
  });

  const options = {
    hostname: APFEL_HOST,   // Must be 127.0.0.1, not 'localhost' (apfel is IPv4-only)
    port: APFEL_PORT,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'Connection': 'close',
    },
  };


  // Set up SSE response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const apfelReq = http.request(options, (apfelRes) => {
    apfelRes.on('data', (chunk) => {
      // Forward SSE data directly to browser
      res.write(chunk);
    });

    apfelRes.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });

    apfelRes.on('error', (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });
  });

  apfelReq.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ error: `Cannot connect to apfel: ${err.message}. Make sure apfel --serve is running.` })}\n\n`);
    res.end();
  });

  apfelReq.setTimeout(120000, () => {
    apfelReq.destroy();
    res.write('data: [DONE]\n\n');
    res.end();
  });

  apfelReq.write(payload);
  apfelReq.end();

  // Clean up only when the BROWSER disconnects from our SSE stream (res closes).
  // DO NOT listen on req 'close' — Express fires that immediately after body
  // parsing is done, which would destroy apfelReq before the response arrives.
  res.on('close', () => {
    apfelReq.destroy();
  });
});


// ─── Helper ──────────────────────────────────────────────────────────────────

function fetchApfel(path, options = {}) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: APFEL_HOST,   // Must be 127.0.0.1, not 'localhost' (apfel is IPv4-only)
      port: APFEL_PORT,
      path,
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('apfel is not running. Start it with: apfel --serve'));
    });
    req.end();
  });
}

// ─── SPA fallback ────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🍎 fruit-chat running at http://localhost:${PORT}`);
  console.log(`   Also accessible on your LAN at http://<your-mac-ip>:${PORT}`);
  console.log(`   Proxying Apple Intelligence via apfel at ${APFEL_BASE}\n`);
});
