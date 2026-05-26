#!/usr/bin/env bash
set -e

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}${BOLD}  ℹ${NC}  $*"; }
success() { echo -e "${GREEN}${BOLD}  ✔${NC}  $*"; }
warn()    { echo -e "${YELLOW}${BOLD}  ⚠${NC}  $*"; }
error()   { echo -e "${RED}${BOLD}  ✘${NC}  $*" >&2; }
header()  { echo -e "\n${BLUE}${BOLD}$*${NC}\n"; }

header "lazynet installer"

# Node.js check
if ! command -v node &>/dev/null; then
  error "Node.js not found. Install Node.js 16+ first."
  echo "  Ubuntu/Debian: sudo apt install nodejs"
  echo "  Or: https://nodejs.org"
  exit 1
fi

NODE_VER=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
if [ "$NODE_VER" -lt 16 ]; then
  error "Node.js 16+ required (found v$NODE_VER)"
  exit 1
fi
success "Node.js $(node --version) found"

# .NET SDK check (optional at install time)
if command -v dotnet &>/dev/null; then
  success ".NET SDK found: $(dotnet --version)"
else
  warn ".NET SDK not found — install it to use build/run features"
  echo "  sudo apt install dotnet-sdk-8.0"
fi

# Determine install directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
info "Installing from: $SCRIPT_DIR"

# Create symlink in /usr/local/bin
TARGET="/usr/local/bin/lazynet"

if [ -w /usr/local/bin ]; then
  ln -sf "$SCRIPT_DIR/index.js" "$TARGET"
  chmod +x "$SCRIPT_DIR/index.js"
  success "Installed to $TARGET"
else
  info "Creating symlink (may ask for password)..."
  sudo ln -sf "$SCRIPT_DIR/index.js" "$TARGET"
  sudo chmod +x "$SCRIPT_DIR/index.js"
  success "Installed to $TARGET (via sudo)"
fi

# User-local alternative
LOCAL_BIN="$HOME/.local/bin"
if [ -d "$LOCAL_BIN" ] && echo "$PATH" | grep -q "$LOCAL_BIN"; then
  ln -sf "$SCRIPT_DIR/index.js" "$LOCAL_BIN/lazynet"
  success "Also linked in $LOCAL_BIN"
fi

header "Installation complete!"
echo -e "  Run ${BOLD}lazynet${NC}                to start (auto-detects .sln)"
echo -e "  Run ${BOLD}lazynet MySolution.sln${NC}  to open a specific solution"
echo -e "  Run ${BOLD}lazynet /path/to/dir${NC}    to search a directory"
echo ""
echo -e "  Press ${BOLD}?${NC} inside the app for keybinding help"
echo ""
