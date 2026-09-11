#!/usr/bin/env sh
# Build the signed/notarized macOS release package and install its app bundle.
#
# Usage:
#   ./build-release.sh
#   ORCB_INSTALL_DIR=/Applications ./build-release.sh
set -eu

ROOT_DIR="$(CDPATH= cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

PNPM_SHIM_DIR=
TEMP_APP=

cleanup() {
  if [ -n "$TEMP_APP" ]; then
    if [ -e "$TEMP_APP" ] || [ -L "$TEMP_APP" ]; then
      run_privileged rm -rf "$TEMP_APP" || true
    fi
  fi
  if [ -n "$PNPM_SHIM_DIR" ] && [ -d "$PNPM_SHIM_DIR" ]; then
    rm -rf "$PNPM_SHIM_DIR"
  fi
}
trap cleanup 0

if [ "$(uname -s)" != "Darwin" ]; then
  echo "This script only supports macOS." >&2
  exit 2
fi

case "$(uname -m)" in
  arm64) MAC_OUTPUT_DIR="mac-arm64" ;;
  x86_64) MAC_OUTPUT_DIR="mac" ;;
  *)
    echo "Unsupported macOS architecture: $(uname -m)" >&2
    exit 2
    ;;
esac

resolve_pnpm() {
  required_version="$(node -p "require('./package.json').packageManager.split('@')[1].split('+')[0]")"
  system_version=
  if command -v pnpm >/dev/null 2>&1; then
    system_version="$(pnpm --version 2>/dev/null || true)"
  fi
  if [ "$system_version" = "$required_version" ]; then
    return 0
  fi

  if [ -n "${COREPACK_HOME:-}" ]; then
    corepack_root="$COREPACK_HOME"
  else
    corepack_root="${XDG_CACHE_HOME:-$HOME/.cache}/node/corepack"
  fi
  pnpm_native="$corepack_root/v1/pnpm/$required_version/pnpm-native"
  native_version=
  if [ -x "$pnpm_native" ]; then
    native_version="$("$pnpm_native" --version 2>/dev/null || true)"
  fi
  if [ "$native_version" != "$required_version" ]; then
    echo "[build-release] pnpm $required_version is unavailable." >&2
    echo "[build-release] Corepack cache is incomplete: $pnpm_native" >&2
    echo "[build-release] Repair Corepack or install pnpm $required_version, then rerun." >&2
    exit 1
  fi

  PNPM_SHIM_DIR="$(mktemp -d "${TMPDIR:-/tmp}/orcb-pnpm-shim.XXXXXX")"
  ln -s "$pnpm_native" "$PNPM_SHIM_DIR/pnpm"
  PATH="$PNPM_SHIM_DIR:$PATH"
  export PATH
  echo "[build-release] using pnpm $required_version native binary from Corepack cache"
}

resolve_pnpm
APP_BUNDLE_NAME="$(node -p "require('./config/electron-builder.config.cjs').productName + '.app'")"
APP_PATH="$ROOT_DIR/dist/$MAC_OUTPUT_DIR/$APP_BUNDLE_NAME"

echo "[build-release] building macOS release package"
pnpm run build:mac:release

if [ ! -d "$APP_PATH" ]; then
  echo "[build-release] packaged app not found: $APP_PATH" >&2
  exit 1
fi

APP_EXECUTABLE="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP_PATH/Contents/Info.plist")"
APP_EXECUTABLE_PATH="$APP_PATH/Contents/MacOS/$APP_EXECUTABLE"
if [ ! -x "$APP_EXECUTABLE_PATH" ]; then
  echo "[build-release] packaged executable not found: $APP_EXECUTABLE_PATH" >&2
  exit 1
fi

INSTALL_DIR="${ORCB_INSTALL_DIR:-/Applications}"
case "$INSTALL_DIR" in
  /*) ;;
  *)
    echo "ORCB_INSTALL_DIR must be an absolute path: $INSTALL_DIR" >&2
    exit 2
    ;;
esac

# Prefer a direct install, then fall back to one authenticated sudo session.
NEEDS_SUDO=0
if [ ! -d "$INSTALL_DIR" ]; then
  if ! mkdir -p "$INSTALL_DIR" 2>/dev/null; then
    NEEDS_SUDO=1
  fi
fi

if [ "$NEEDS_SUDO" -eq 0 ] && [ -w "$INSTALL_DIR" ]; then
  run_privileged() { "$@"; }
else
  if ! command -v sudo >/dev/null 2>&1; then
    echo "Cannot write to $INSTALL_DIR and sudo is unavailable." >&2
    exit 1
  fi
  sudo -v
  run_privileged() { sudo "$@"; }
fi

INSTALL_PATH="$INSTALL_DIR/$APP_BUNDLE_NAME"
TEMP_APP="$INSTALL_DIR/.${APP_BUNDLE_NAME}.tmp.$$"
if [ -e "$TEMP_APP" ] || [ -L "$TEMP_APP" ]; then
  echo "Temporary install path already exists: $TEMP_APP" >&2
  exit 1
fi

echo "[build-release] installing $APP_BUNDLE_NAME into $INSTALL_DIR"
run_privileged ditto "$APP_PATH" "$TEMP_APP"

if [ ! -x "$TEMP_APP/Contents/MacOS/$APP_EXECUTABLE" ]; then
  echo "Copied app is missing its executable: $TEMP_APP/Contents/MacOS/$APP_EXECUTABLE" >&2
  exit 1
fi

if [ -e "$INSTALL_PATH" ] || [ -L "$INSTALL_PATH" ]; then
  run_privileged rm -rf "$INSTALL_PATH"
fi
run_privileged mv "$TEMP_APP" "$INSTALL_PATH"
TEMP_APP=

echo "[build-release] installed: $INSTALL_PATH"
