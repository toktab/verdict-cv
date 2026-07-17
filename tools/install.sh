#!/usr/bin/env bash
#
#  install.sh — VERDICT CLI installer for macOS and Linux
#
#  Usage:
#    curl -fsSL https://your-server/api/system/cli/install.sh | bash
#    bash install.sh --server http://localhost:8080
#
#  Options:
#    --server URL         VERDICT server (default: http://localhost:8080)
#    --install-dir PATH   Installation directory (default: ~/.local/bin)
#    --no-path            Skip PATH modification
#    --no-start-menu      Skip creating desktop entry (Linux only)
#    --quiet              Suppress prompts
#

set -euo pipefail

# ── Defaults ─────────────────────────────────────────────────────────
VERDICT_SERVER="http://localhost:8080"
INSTALL_DIR=""
NO_PATH=false
NO_START_MENU=false
QUIET=false

# ── Parse arguments ──────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --server)       VERDICT_SERVER="$2"; shift 2 ;;
        --install-dir)  INSTALL_DIR="$2"; shift 2 ;;
        --no-path)      NO_PATH=true; shift ;;
        --no-start-menu) NO_START_MENU=true; shift ;;
        --quiet)        QUIET=true; shift ;;
        --help|-h)      echo "Usage: bash install.sh [--server URL] [--install-dir PATH] [--no-path] [--quiet]"; exit 0 ;;
        *)              echo "Unknown option: $1"; exit 2 ;;
    esac
done

# ── Detect platform ──────────────────────────────────────────────────
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
    x86_64|amd64) ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

if [[ "$OS" != "linux" && "$OS" != "darwin" ]]; then
    echo "Unsupported OS: $OS. Use the Node.js version directly: node tools/verdict-cli/verdict.mjs"
    exit 1
fi

# ── Determine install directory ──────────────────────────────────────
if [[ -z "$INSTALL_DIR" ]]; then
    if [[ -d "${HOME}/.local/bin" ]]; then
        INSTALL_DIR="${HOME}/.local/bin"
    elif [[ -d "/usr/local/bin" && -w "/usr/local/bin" ]]; then
        INSTALL_DIR="/usr/local/bin"
    else
        INSTALL_DIR="${HOME}/.local/bin"
    fi
fi

# ── Check for Node.js ────────────────────────────────────────────────
NODE_PATH=""
if command -v node &>/dev/null; then
    NODE_MAJOR="$(node --version | sed 's/v//' | cut -d. -f1)"
    if [[ "$NODE_MAJOR" -ge 22 ]]; then
        NODE_PATH="$(command -v node)"
    fi
fi

if [[ -z "$NODE_PATH" ]]; then
    echo ""
    echo "  Node.js 22+ is required."
    echo "  Install it from https://nodejs.org or use nvm:"
    echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
    echo "    nvm install 22"
    echo ""
    echo "  Then re-run this installer."
    exit 1
fi

# ── Welcome ──────────────────────────────────────────────────────────
echo ""
echo "  VERDICT CLI INSTALLER"
echo "  Secure terminal access for your VERDICT workspace"
echo ""

mkdir -p "$INSTALL_DIR"
echo "  Installing into $INSTALL_DIR"

# ── Install verdict.mjs and create wrapper ────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MJS_TARGET="${INSTALL_DIR}/verdict.mjs"
WRAPPER_TARGET="${INSTALL_DIR}/verdict"
README_TARGET="${INSTALL_DIR}/verdict-README.txt"

# Copy from local source or download from server
if [[ -f "${SCRIPT_DIR}/tools/verdict-cli/verdict.mjs" ]]; then
    cp "${SCRIPT_DIR}/tools/verdict-cli/verdict.mjs" "$MJS_TARGET"
    echo "  Installed verdict.mjs from local source."
else
    DOWNLOAD_BASE="${VERDICT_SERVER}/api/system/cli/files"
    echo "  Downloading from ${DOWNLOAD_BASE}..."
    if command -v curl &>/dev/null; then
        curl -fsSL "${DOWNLOAD_BASE}/verdict.mjs" -o "$MJS_TARGET" || {
            echo "  Download failed. Check your server URL and internet connection."
            exit 1
        }
    elif command -v wget &>/dev/null; then
        wget -q "${DOWNLOAD_BASE}/verdict.mjs" -O "$MJS_TARGET" || {
            echo "  Download failed. Check your server URL and internet connection."
            exit 1
        }
    else
        echo "  Neither curl nor wget are available. Install one and re-run."
        exit 1
    fi
fi
chmod +x "$MJS_TARGET"

# ── Create verdict wrapper ───────────────────────────────────────────
cat > "$WRAPPER_TARGET" << WRAPPER_EOF
#!/usr/bin/env bash
exec node "\$(dirname "\$0")/verdict.mjs" "\$@"
WRAPPER_EOF
chmod +x "$WRAPPER_TARGET"

# ── Download README (optional) ────────────────────────────────────────
if [[ -f "${SCRIPT_DIR}/tools/verdict-cli/README.txt" ]]; then
    cp "${SCRIPT_DIR}/tools/verdict-cli/README.txt" "$README_TARGET" 2>/dev/null || true
else
    if command -v curl &>/dev/null; then
        curl -fsSL "${DOWNLOAD_BASE}/README.txt" -o "$README_TARGET" 2>/dev/null || true
    elif command -v wget &>/dev/null; then
        wget -q "${DOWNLOAD_BASE}/README.txt" -O "$README_TARGET" 2>/dev/null || true
    fi
fi

# ── Add to PATH ──────────────────────────────────────────────────────
if [[ "$NO_PATH" == "false" ]]; then
    SHELL_CONFIG=""
    case "$SHELL" in
        */zsh)  SHELL_CONFIG="${HOME}/.zshrc" ;;
        */bash) SHELL_CONFIG="${HOME}/.bashrc" ;;
    esac
    [[ -z "$SHELL_CONFIG" ]] && SHELL_CONFIG="${HOME}/.profile"

    if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
        echo "export PATH=\"\${PATH}:${INSTALL_DIR}\"" >> "$SHELL_CONFIG"
        export PATH="${PATH}:${INSTALL_DIR}"
        echo "  Added ${INSTALL_DIR} to PATH in ${SHELL_CONFIG}"
    fi
fi

# ── Configure server ─────────────────────────────────────────────────
node "$MJS_TARGET" config set server "$VERDICT_SERVER" 2>/dev/null || true

# ── Desktop entry (Linux only) ───────────────────────────────────────
if [[ "$OS" == "linux" && "$NO_START_MENU" == "false" ]]; then
    DESKTOP_DIR="${HOME}/.local/share/applications"
    mkdir -p "$DESKTOP_DIR"
    cat > "${DESKTOP_DIR}/verdict-cli.desktop" << DESKTOP_EOF
[Desktop Entry]
Name=VERDICT CLI
Comment=Secure terminal access for your VERDICT workspace
Exec=${INSTALL_DIR}/verdict help
Terminal=true
Type=Application
Categories=Development;Utility;
NoDisplay=true
DESKTOP_EOF
    echo "  Created desktop entry."
fi

# ── Done ─────────────────────────────────────────────────────────────
echo ""
echo "  VERDICT CLI IS READY"
echo "  Server:  $VERDICT_SERVER"
echo "  Command: verdict"
echo "  Install: ${INSTALL_DIR}/verdict.mjs"
echo ""
echo "  Next: open VERDICT Profile, generate a pairing code, then run:"
echo "        verdict connect ABCD-EFGH"
echo ""
echo "  New terminals can use verdict immediately."
echo ""
