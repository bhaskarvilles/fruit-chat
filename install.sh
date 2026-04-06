#!/usr/bin/env bash
# ╔═══════════════════════════════════════════════════════════════════╗
#  fruit-chat installer
#  Apple Intelligence Web UI — on-device, no API keys, no cloud
#
#  Usage (curl):
#    curl -fsSL https://raw.githubusercontent.com/bhaskarvilles/fruit-chat/main/install.sh | bash
#
#  Usage (local):
#    chmod +x install.sh && ./install.sh
# ╚═══════════════════════════════════════════════════════════════════╝

set -euo pipefail

# ── Colours ────────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; BOLD=''; DIM=''; RESET=''
fi

log()    { echo -e "${BLUE}▶${RESET} $*"; }
ok()     { echo -e "${GREEN}✓${RESET} $*"; }
warn()   { echo -e "${YELLOW}⚠${RESET} $*"; }
err()    { echo -e "${RED}✗ ERROR:${RESET} $*" >&2; }
step()   { echo -e "\n${BOLD}${CYAN}$*${RESET}"; }
info()   { echo -e "  ${DIM}$*${RESET}"; }

# ── Config ────────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/bhaskarvilles/fruit-chat.git"
RAW_BASE="https://raw.githubusercontent.com/bhaskarvilles/fruit-chat/main"
INSTALL_DIR="${FRUITCHAT_DIR:-$HOME/.fruit-chat}"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
WEB_PORT="${FRUITCHAT_PORT:-4321}"
APFEL_PORT=11434

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  🍎  fruit-chat${RESET}  ${DIM}Apple Intelligence Web UI${RESET}"
echo -e "  ${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ── 1. Platform check ─────────────────────────────────────────────────────────
step "1/7  Checking platform"

OS="$(uname -s)"
ARCH="$(uname -m)"

if [ "$OS" != "Darwin" ]; then
  err "fruit-chat requires macOS (Apple Intelligence is macOS-only)."
  err "Detected OS: $OS"
  exit 1
fi

if [ "$ARCH" != "arm64" ]; then
  warn "Intel Mac detected ($ARCH). Apple Intelligence requires Apple Silicon."
  warn "Continuing, but apfel may not work without an M-series chip."
fi

OS_VER=$(sw_vers -productVersion)
OS_MAJOR=$(echo "$OS_VER" | cut -d. -f1)
if [ "$OS_MAJOR" -lt 26 ]; then
  warn "macOS $OS_VER detected. Apple Intelligence needs macOS 26 (Tahoe)+."
  warn "The web UI will install, but AI features won't work until you upgrade."
else
  ok "macOS $OS_VER — compatible"
fi

# ── 2. Homebrew ───────────────────────────────────────────────────────────────
step "2/7  Checking Homebrew"

if ! command -v brew &>/dev/null; then
  log "Installing Homebrew…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add brew to PATH for Apple Silicon
  if [ -f /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
fi
ok "Homebrew $(brew --version | head -1 | sed 's/Homebrew //')"

# ── 3. apfel ─────────────────────────────────────────────────────────────────
step "3/7  Installing apfel (Apple Intelligence CLI)"
info "Source: https://github.com/Arthur-Ficial/apfel"

if command -v apfel &>/dev/null; then
  APFEL_VER=$(apfel --version 2>/dev/null | head -1 || echo "installed")
  ok "apfel already installed ($APFEL_VER)"
  log "Checking for updates…"
  brew upgrade apfel 2>/dev/null || true
else
  log "Tapping Arthur-Ficial/tap…"
  brew tap Arthur-Ficial/tap
  log "Installing apfel…"
  brew install apfel
  ok "apfel installed"
fi

APFEL_BIN="$(command -v apfel)"

# ── 4. Node.js ────────────────────────────────────────────────────────────────
step "4/7  Checking Node.js"

if ! command -v node &>/dev/null; then
  log "Installing Node.js via Homebrew…"
  brew install node
fi

NODE_VER=$(node --version)
NODE_MAJOR=$(echo "$NODE_VER" | tr -d 'v' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  err "Node.js $NODE_VER is too old (need v18+). Run: brew upgrade node"
  exit 1
fi

NODE_BIN="$(command -v node)"
ok "Node.js $NODE_VER"

# ── 5. Download fruit-chat ────────────────────────────────────────────────────
step "5/7  Installing fruit-chat"

# Detect if we're running the script locally (already have the files beside us)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-./install.sh}")" 2>/dev/null && pwd || echo "")"
LOCAL_MODE=false
if [ -f "$SCRIPT_DIR/server.js" ] && [ -f "$SCRIPT_DIR/package.json" ]; then
  LOCAL_MODE=true
  INSTALL_DIR="$SCRIPT_DIR"
  info "Detected local repository at $INSTALL_DIR"
fi

if [ "$LOCAL_MODE" = false ]; then
  if [ -d "$INSTALL_DIR" ]; then
    log "Updating existing installation at $INSTALL_DIR…"
    git -C "$INSTALL_DIR" pull --ff-only 2>/dev/null || {
      warn "Pull failed, reinstalling from scratch…"
      rm -rf "$INSTALL_DIR"
      git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
    }
  else
    log "Cloning fruit-chat to $INSTALL_DIR…"
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
  fi
  ok "fruit-chat downloaded to $INSTALL_DIR"
fi

log "Installing Node.js dependencies…"
cd "$INSTALL_DIR"
npm install --prefer-offline --silent
ok "npm packages ready"

# ── 6. LaunchAgents ──────────────────────────────────────────────────────────
step "6/7  Registering system daemons (auto-start on login)"

mkdir -p "$LAUNCH_AGENTS"

# ── apfel daemon ──
APFEL_PLIST="$LAUNCH_AGENTS/com.fruitchat.apfel.plist"
log "Registering apfel daemon…"
cat > "$APFEL_PLIST" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.fruitchat.apfel</string>
    <key>ProgramArguments</key>
    <array>
        <string>${APFEL_BIN}</string>
        <string>--serve</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>5</integer>
    <key>StandardOutPath</key>
    <string>/tmp/fruitchat-apfel.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/fruitchat-apfel-error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>${HOME}</string>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
PLIST_EOF

launchctl unload "$APFEL_PLIST" 2>/dev/null || true
launchctl load -w "$APFEL_PLIST"
ok "apfel daemon registered (port $APFEL_PORT)"

# ── web server daemon ──
SERVER_PLIST="$LAUNCH_AGENTS/com.fruitchat.server.plist"
log "Registering web server daemon…"
cat > "$SERVER_PLIST" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.fruitchat.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_BIN}</string>
        <string>${INSTALL_DIR}/server.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>5</integer>
    <key>StandardOutPath</key>
    <string>/tmp/fruitchat-server.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/fruitchat-server-error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>${HOME}</string>
        <key>PORT</key>
        <string>${WEB_PORT}</string>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
    <key>WorkingDirectory</key>
    <string>${INSTALL_DIR}</string>
</dict>
</plist>
PLIST_EOF

launchctl unload "$SERVER_PLIST" 2>/dev/null || true
launchctl load -w "$SERVER_PLIST"
ok "Web server daemon registered (port $WEB_PORT)"

# ── 7. Health check ───────────────────────────────────────────────────────────
step "7/7  Starting services"

log "Waiting for services to initialise…"
sleep 4

APFEL_OK=false
SERVER_OK=false

if curl -sf --max-time 3 "http://127.0.0.1:${APFEL_PORT}/health" >/dev/null 2>&1; then
  APFEL_OK=true
  ok "apfel is running  →  http://127.0.0.1:${APFEL_PORT}"
else
  warn "apfel is still starting (Apple Intelligence initialises asynchronously)"
  info "Check logs: tail -f /tmp/fruitchat-apfel.log"
fi

if curl -sf --max-time 3 "http://127.0.0.1:${WEB_PORT}" >/dev/null 2>&1; then
  SERVER_OK=true
  ok "Web UI is running →  http://localhost:${WEB_PORT}"
else
  warn "Web server is still starting…"
  info "Check logs: tail -f /tmp/fruitchat-server.log"
fi

# Try to get local IP for LAN access
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "<your-mac-ip>")

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}✅  fruit-chat installed successfully!${RESET}"
echo ""
echo -e "  ${BOLD}Open in browser:${RESET}"
echo -e "    ${CYAN}http://localhost:${WEB_PORT}${RESET}          (this Mac)"
echo -e "    ${CYAN}http://${LAN_IP}:${WEB_PORT}${RESET}   (any device on your LAN)"
echo ""
echo -e "  ${BOLD}Both services auto-start on every login.${RESET}"
echo ""
echo -e "  ${BOLD}Useful commands:${RESET}"
echo -e "    ${DIM}View apfel log:${RESET}   tail -f /tmp/fruitchat-apfel.log"
echo -e "    ${DIM}View server log:${RESET}  tail -f /tmp/fruitchat-server.log"
echo -e "    ${DIM}Uninstall:${RESET}        bash ${INSTALL_DIR}/uninstall.sh"
echo -e "    ${DIM}Update:${RESET}           curl -fsSL ${RAW_BASE}/install.sh | bash"
echo ""
echo -e "  ${BOLD}Requirements reminder:${RESET}"
echo -e "    ${DIM}Apple Silicon Mac + macOS 26 (Tahoe) + Apple Intelligence enabled${RESET}"
echo ""

# Open in default browser
if [ "$SERVER_OK" = true ] && command -v open &>/dev/null; then
  sleep 1
  open "http://localhost:${WEB_PORT}"
fi
