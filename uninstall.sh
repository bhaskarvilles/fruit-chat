#!/usr/bin/env bash
# fruit-chat uninstaller

set -euo pipefail

if [ -t 1 ]; then
  GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; RESET='\033[0m'
else
  GREEN=''; YELLOW=''; RED=''; BOLD=''; RESET=''
fi

log()  { echo -e "  ▶ $*"; }
ok()   { echo -e "  ${GREEN}✓${RESET} $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET} $*"; }

LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
INSTALL_DIR="${FRUITCHAT_DIR:-$HOME/.fruit-chat}"

echo ""
echo -e "${BOLD}🍎 fruit-chat · Uninstaller${RESET}"
echo ""

# Stop & remove launchd agents
for label in com.fruitchat.apfel com.fruitchat.server; do
  PLIST="$LAUNCH_AGENTS/${label}.plist"
  if [ -f "$PLIST" ]; then
    log "Stopping $label…"
    launchctl unload "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    ok "Removed $PLIST"
  fi
done

# Remove logs
rm -f /tmp/fruitchat-*.log
ok "Logs removed"

# Remove install dir (only if it was a curl install, not a local clone)
if [ -d "$INSTALL_DIR" ] && [ "$INSTALL_DIR" != "$(pwd)" ]; then
  read -rp "  Remove installation directory ($INSTALL_DIR)? [y/N] " ans
  if [[ "${ans,,}" == "y" ]]; then
    rm -rf "$INSTALL_DIR"
    ok "Removed $INSTALL_DIR"
  else
    warn "Skipped removing $INSTALL_DIR"
  fi
fi

# Optionally remove apfel
read -rp "  Uninstall apfel via Homebrew? [y/N] " ans
if [[ "${ans,,}" == "y" ]]; then
  brew uninstall apfel 2>/dev/null || true
  ok "apfel uninstalled"
else
  warn "Kept apfel installed"
fi

echo ""
echo -e "${GREEN}✅ fruit-chat uninstalled.${RESET}"
echo ""
