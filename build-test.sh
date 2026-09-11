#!/usr/bin/env sh
# Build the local macOS test package and launch the packaged app.
#
# Usage:
#   ./build-test.sh
#   ORCA_BACKGROUND_LAUNCH=1 ./build-test.sh
set -eu

ROOT_DIR="$(CDPATH= cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

PNPM_SHIM_DIR=

cleanup() {
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
    echo "[build-test] pnpm $required_version is unavailable." >&2
    echo "[build-test] Corepack cache is incomplete: $pnpm_native" >&2
    echo "[build-test] Repair Corepack or install pnpm $required_version, then rerun." >&2
    exit 1
  fi

  PNPM_SHIM_DIR="$(mktemp -d "${TMPDIR:-/tmp}/orcb-pnpm-shim.XXXXXX")"
  ln -s "$pnpm_native" "$PNPM_SHIM_DIR/pnpm"
  PATH="$PNPM_SHIM_DIR:$PATH"
  export PATH
  echo "[build-test] using pnpm $required_version native binary from Corepack cache"
}

resolve_pnpm
APP_BUNDLE_NAME="$(node -p "require('./config/electron-builder.config.cjs').productName + '.app'")"
APP_PATH="$ROOT_DIR/dist/$MAC_OUTPUT_DIR/$APP_BUNDLE_NAME"

echo "[build-test] building local macOS package"
pnpm run build:mac

if [ ! -d "$APP_PATH" ]; then
  echo "[build-test] packaged app not found: $APP_PATH" >&2
  exit 1
fi

APP_EXECUTABLE="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP_PATH/Contents/Info.plist")"
APP_EXECUTABLE_PATH="$APP_PATH/Contents/MacOS/$APP_EXECUTABLE"
if [ ! -x "$APP_EXECUTABLE_PATH" ]; then
  echo "[build-test] packaged executable not found: $APP_EXECUTABLE_PATH" >&2
  exit 1
fi

if [ "${ORCA_BACKGROUND_LAUNCH:-0}" = "1" ]; then
  LOG_PATH="${ORCB_TEST_LAUNCH_LOG:-${TMPDIR:-/tmp}/orcb-test-launch.log}"
  mkdir -p "$(dirname "$LOG_PATH")"
  echo "[build-test] launching in background; log: $LOG_PATH"
  nohup env ORCA_BACKGROUND_LAUNCH=1 "$APP_EXECUTABLE_PATH" >"$LOG_PATH" 2>&1 &
  echo "[build-test] launched pid=$!"
else
  echo "[build-test] launching $APP_PATH"
  open "$APP_PATH"
fi
