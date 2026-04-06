# 🍎 fruit-chat

> **Apple Intelligence in your browser.** A premium, private, on-device AI chat powered by [apfel](https://github.com/Arthur-Ficial/apfel) and Apple's Foundation Models framework.

No API keys. No cloud. No subscriptions. Runs entirely on your Apple Silicon Mac.

---

## Features

- 🔒 **100% On-device** — Apple Intelligence processes everything locally via `FoundationModels`
- 🌐 **Any Apple Device** — Access from Mac, iPhone, or iPad on your local network
- ⚡ **Real-time Streaming** — Tokens stream live as the model generates
- 💾 **Conversation History** — All chats stored locally in your browser
- ⚙️ **Configurable** — System prompt, temperature, max tokens
- 🔄 **Persistent Daemon** — Auto-starts on every login/reboot via macOS LaunchAgents
- 📱 **Responsive UI** — Glassmorphism design that works on any screen size

## Requirements

- Apple Silicon Mac (M1 or newer)
- macOS 26 (Tahoe) or newer
- Apple Intelligence enabled in System Settings
- Homebrew
- Node.js 18+

## Quick Install

```bash
cd fruit-chat
chmod +x install.sh uninstall.sh
./install.sh
```

The installer will:
1. Install `apfel` via Homebrew (if not present)
2. Install Node.js dependencies
3. Register two LaunchAgents that auto-start on every login:
   - `com.fruitchat.apfel` — runs `apfel --serve` at `localhost:11434`
   - `com.fruitchat.server` — runs the web UI at `localhost:4321`
4. Open the chat in your browser

## Usage

After installation, open:

```
http://localhost:4321
```

From any device on your LAN:

```
http://<your-mac-ip>:4321
```

## Manual Start (Development)

```bash
# Terminal 1 — start the Apple Intelligence server
apfel --serve

# Terminal 2 — start the web UI
npm start
```

Then open `http://localhost:4321`

## Uninstall

```bash
./uninstall.sh
```

## Ports

| Service | Port |
|---|---|
| fruit-chat Web UI | `4321` |
| apfel OpenAI-compatible API | `11434` |

## Logs

```bash
# Apple Intelligence server logs
tail -f /tmp/fruitchat-apfel.log

# Web server logs
tail -f /tmp/fruitchat-server.log
```

## Architecture

```
Browser / Any Apple Device
        ↕ :4321
fruit-chat Node.js server
        ↕ :11434 (OpenAI-compatible API)
apfel --serve (Swift CLI)
        ↕ Native Framework
Apple FoundationModels (on-device LLM)
```

## License

MIT
