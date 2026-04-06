# 🍎 fruit-chat

> **Apple Intelligence in your browser.** A premium, private, on-device AI chat powered by [apfel](https://github.com/Arthur-Ficial/apfel) and Apple's Foundation Models framework.

No API keys. No cloud. No subscriptions. Runs entirely on your Apple Silicon Mac.

---

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/bhaskarvilles/fruit-chat/main/install.sh | bash
```

That's it. The script will:
1. Install `apfel` via Homebrew (Apple Intelligence CLI)
2. Install Node.js if needed
3. Download `fruit-chat` to `~/.fruit-chat`
4. Register two LaunchAgents → **auto-start on every login**
5. Open `http://localhost:4321` in your browser

---

## Features

- 🔒 **100% On-device** — Apple Intelligence processes everything locally via `FoundationModels`
- 🌐 **Any Apple Device** — Access from Mac, iPhone, or iPad on your local network
- ⚡ **Real-time Streaming** — Tokens stream live as the model generates
- 🌙 **Dark & Light Mode** — Toggle between dark, light, and auto (system) themes
- 💾 **Conversation History** — All chats stored locally in your browser
- ⚙️ **Configurable** — System prompt, temperature, max tokens
- 🔄 **Persistent Daemon** — Auto-starts on every login/reboot via macOS LaunchAgents
- 📱 **Responsive UI** — Glassmorphism design that works on any screen size

## Requirements

- Apple Silicon Mac (M1 or newer)
- macOS 26 (Tahoe) or newer
- Apple Intelligence enabled in System Settings
- [Homebrew](https://brew.sh)
- Node.js 18+ (auto-installed if missing)

## Access

After installation, open:

```
http://localhost:4321           # This Mac
http://<your-mac-ip>:4321       # Any device on your LAN
```

## Update

Re-run the same install command — it pulls the latest and restarts the daemons:

```bash
curl -fsSL https://raw.githubusercontent.com/bhaskarvilles/fruit-chat/main/install.sh | bash
```

## Uninstall

```bash
bash ~/.fruit-chat/uninstall.sh
```

## Manual / Developer Setup

```bash
git clone https://github.com/bhaskarvilles/fruit-chat.git
cd fruit-chat
./install.sh    # same script, detects local mode automatically
```

Or run manually without daemons:

```bash
# Terminal 1 — start Apple Intelligence server
apfel --serve

# Terminal 2 — start the web UI
npm start          # runs: node server.js
```

## Ports

| Service | Port |
|---|---|
| fruit-chat Web UI | `4321` |
| apfel OpenAI-compatible API | `11434` |

## Logs

```bash
tail -f /tmp/fruitchat-apfel.log    # Apple Intelligence server
tail -f /tmp/fruitchat-server.log   # Web UI server
```

## Architecture

```
Browser / Any Apple Device
        ↕ HTTP :4321
fruit-chat  (Node.js + Express)
        ↕ SSE :11434 (OpenAI-compatible)
apfel --serve  (Swift CLI)
        ↕ Native Swift Framework
Apple FoundationModels  (on-device LLM)
```

## License

MIT
