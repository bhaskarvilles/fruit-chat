#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
#  fruit-chat · install.sh
#  One-command installer — sets up apfel + Node server as
#  macOS LaunchAgents (auto-start on every login/reboot)
# ═══════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

log()    { echo -e "${BLUE}▶${RESET} $*"; }
ok()     { echo -e "${GREEN}✓${RESET} $*"; }
warn()   { echo -e "${YELLOW}⚠${RESET} $*"; }
err()    { echo -e "${RED}✗${RESET} $*" >&2; }
banner() { echo -e "\n${BOLD}$*${RESET}\n"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PORT=4321

banner "🍎 fruit-chat Installer"
echo "   Apple Intelligence Web UI + Persistent Daemon"
echo "   ───────────────────────────────────────────────"

# ── 1. Check macOS ───────────────────────────────────────────────────────────
log "Checking macOS version…"
OS_VERSION=$(sw_vers -productVersion)
OS_MAJOR=$(echo "$OS_VERSION" | cut -d. -f1)
if [ "$OS_MAJOR" -lt 26 ]; then
  warn "macOS $OS_VERSION detected. apfel requires macOS 26 (Tahoe) or newer."
  warn "The web UI will install but Apple Intelligence won't work until you upgrade."
else
  ok "macOS $OS_VERSION — compatible"
fi

# ── 2. Check Homebrew ────────────────────────────────────────────────────────
log "Checking Homebrew…"
if ! command -v brew &>/dev/null; then
  err "Homebrew not found. Install it from https://brew.sh then re-run this script."
  exit 1
fi
ok "Homebrew found: $(brew --version | head -1)"

# ── 3. Install / verify apfel ────────────────────────────────────────────────
log "Checking apfel…"
if command -v apfel &>/dev/null; then
  ok "apfel already installed: $(apfel --version 2>/dev/null || echo 'unknown version')"
else
  log "Installing apfel via Homebrew…"
  brew tap Arthur-Ficial/tap
  brew install apfel
  ok "apfel installed"
fi

APFEL_PATH="$(command -v apfel)"

# ── 4. Check Node.js ──────────────────────────────────────────────────────────
log "Checking Node.js…"
if ! command -v node &>/dev/null; then
  log "Installing Node.js via Homebrew…"
  brew install node
fi
NODE_VERSION=$(node --version)
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  err "Node.js $NODE_VERSION is too old. Need v18+. Run: brew upgrade node"
  exit 1
fi
NODE_PATH="$(command -v node)"
ok "Node.js $NODE_VERSION found at $NODE_PATH"

# ── 5. Install npm dependencies ───────────────────────────────────────────────
log "Installing Node.js dependencies…"
cd "$SCRIPT_DIR"
npm install --prefer-offline --silent
ok "npm packages installed"

# ── 6. Create LaunchAgents directory ─────────────────────────────────────────
mkdir -p "$LAUNCH_AGENTS_DIR"

# ── 7. Install apfel LaunchAgent ──────────────────────────────────────────────
log "Installing apfel LaunchAgent (com.fruitchat.apfel)…"

APFEL_PLIST="$LAUNCH_AGENTS_DIR/com.fruitchat.apfel.plist"
sed \
  -e "s|PLACEHOLDER_HOME|$HOME|g" \
  -e "s|/opt/homebrew/bin/apfel|$APFEL_PATH|g" \
  "$SCRIPT_DIR/com.fruitchat.apfel.plist" > "$APFEL_PLIST"

# Unload if already loaded
launchctl unload "$APFEL_PLIST" 2>/dev/null || true
launchctl load -w "$APFEL_PLIST"
ok "apfel daemon loaded"

# ── 8. Install server LaunchAgent ─────────────────────────────────────────────
log "Installing fruit-chat server LaunchAgent (com.fruitchat.server)…"

SERVER_PLIST="$LAUNCH_AGENTS_DIR/com.fruitchat.server.plist"
sed \
  -e "s|PLACEHOLDER_HOME|$HOME|g" \
  -e "s|PLACEHOLDER_NODE|$NODE_PATH|g" \
  -e "s|PLACEHOLDER_SERVER|$SCRIPT_DIR/server.js|g" \
  -e "s|PLACEHOLDER_DIR|$SCRIPT_DIR|g" \
  "$SCRIPT_DIR/com.fruitchat.server.plist" > "$SERVER_PLIST"

launchctl unload "$SERVER_PLIST" 2>/dev/null || true
launchctl load -w "$SERVER_PLIST"
ok "fruit-chat server daemon loaded"

# ── 9. Wait for services to start ────────────────────────────────────────────
log "Waiting for services to start…"
sleep 3

# Check apfel
if curl -sf http://localhost:11434/health >/dev/null 2>&1; then
  ok "apfel is running at http://localhost:11434"
else
  warn "apfel is still starting (this is normal on first run — Apple Intelligence needs to initialize)"
fi

# Check web server
if curl -sf http://localhost:$PORT >/dev/null 2>&1; then
  ok "fruit-chat UI is running at http://localhost:$PORT"
else
  warn "Web server is still starting…"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}✓ Installation complete!${RESET}"
echo ""
echo -e "  ${BOLD}Web UI:${RESET}        http://localhost:$PORT"
echo -e "  ${BOLD}LAN access:${RESET}    http://$(ipconfig getifaddr en0 2>/dev/null || echo '<your-mac-ip>'):$PORT"
echo -e "  ${BOLD}apfel API:${RESET}     http://localhost:11434"
echo ""
echo -e "  ${BOLD}Logs:${RESET}"
echo -e "    apfel:  /tmp/fruitchat-apfel.log"
echo -e "    server: /tmp/fruitchat-server.log"
echo ""
echo -e "  ${BOLD}Both services auto-start on every login/reboot.${RESET}"
echo ""
echo -e "  To open the chat, run:"
echo -e "    ${BOLD}open http://localhost:$PORT${RESET}"
echo ""

# Open in default browser
if command -v open &>/dev/null; then
  sleep 1
  open "http://localhost:$PORT"
fi
