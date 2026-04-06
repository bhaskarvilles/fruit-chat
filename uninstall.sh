#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
#  fruit-chat · uninstall.sh
#  Cleanly removes fruit-chat daemons from macOS LaunchAgents
# ═══════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${BLUE}▶${RESET} $*"; }
ok()   { echo -e "${GREEN}✓${RESET} $*"; }
warn() { echo -e "${YELLOW}⚠${RESET} $*"; }

LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"

echo -e "\n${BOLD}🍎 fruit-chat Uninstaller${RESET}\n"

# Unload and remove apfel daemon
log "Removing apfel daemon…"
APFEL_PLIST="$LAUNCH_AGENTS_DIR/com.fruitchat.apfel.plist"
if [ -f "$APFEL_PLIST" ]; then
  launchctl unload "$APFEL_PLIST" 2>/dev/null || true
  rm -f "$APFEL_PLIST"
  ok "apfel daemon removed"
else
  warn "apfel daemon not found (already uninstalled?)"
fi

# Unload and remove server daemon
log "Removing fruit-chat server daemon…"
SERVER_PLIST="$LAUNCH_AGENTS_DIR/com.fruitchat.server.plist"
if [ -f "$SERVER_PLIST" ]; then
  launchctl unload "$SERVER_PLIST" 2>/dev/null || true
  rm -f "$SERVER_PLIST"
  ok "Server daemon removed"
else
  warn "Server daemon not found (already uninstalled?)"
fi

# Remove temp logs
log "Cleaning up logs…"
rm -f /tmp/fruitchat-*.log
ok "Logs removed"

# Optional: remove apfel binary
echo ""
read -p "Remove apfel binary via Homebrew? [y/N] " -r REMOVE_APFEL
if [[ "$REMOVE_APFEL" =~ ^[Yy]$ ]]; then
  if command -v brew &>/dev/null && brew list apfel &>/dev/null 2>&1; then
    brew uninstall apfel
    ok "apfel uninstalled"
  else
    warn "apfel not installed via Homebrew, skipping"
  fi
fi

echo ""
echo -e "${BOLD}${GREEN}✓ fruit-chat successfully uninstalled.${RESET}"
echo ""
echo "  Note: The app files in this directory were not deleted."
echo "  To reinstall, run: ./install.sh"
echo ""
