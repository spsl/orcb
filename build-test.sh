#!/usr/bin/env sh
# Build the local macOS test package and launch the packaged app.
#
# Usage:
#   ./build-test.sh
#   ./build-test.sh --isolated
#   ./build-test.sh --shared
#   ORCA_BACKGROUND_LAUNCH=1 ./build-test.sh
#
# Why the default is not always the installed profile: a packaged test build shares the `orcb`
# userData profile with the installed app, and Electron's single-instance lock makes the second
# launch exit without a window (code 3), which reads as a crash. When another instance owns that
# profile, the test package is launched with an isolated profile instead.
#
# Env:
#   ORCA_BACKGROUND_LAUNCH=1  launch off screen, without stealing focus
#   ORCB_TEST_PROFILE_DIR     isolated profile root (default: ~/Library/Application Support/orcb-test-profile)
#   ORCB_TEST_LAUNCH_LOG      stderr log for detached launches (default: ${TMPDIR:-/tmp}/orcb-test-launch.log)
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

usage() {
  cat <<'EOF'
Usage: ./build-test.sh [--isolated|--shared]

  --isolated  Launch the test package with an isolated profile, so it can run next to an
              already-running orcb. This is what the script picks when another instance owns
              the installed profile.
  --shared    Launch with the installed orcb profile. If another instance owns it, the launch
              exits without a window.

Env:
  ORCA_BACKGROUND_LAUNCH=1  Launch off screen, without stealing focus.
  ORCB_TEST_PROFILE_DIR     Isolated profile root (default: ~/Library/Application Support/orcb-test-profile).
  ORCB_TEST_LAUNCH_LOG      stderr log for detached launches (default: ${TMPDIR:-/tmp}/orcb-test-launch.log).
EOF
}

LAUNCH_MODE=auto
for arg in "$@"; do
  case "$arg" in
    --isolated) LAUNCH_MODE=isolated ;;
    --shared) LAUNCH_MODE=shared ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[build-test] unknown argument: $arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

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

APP_NAME="$(node -p "require('./config/electron-builder.config.cjs').productName")"
SHARED_PROFILE_DIR="$HOME/Library/Application Support/$APP_NAME"
ISOLATED_PROFILE_DIR="${ORCB_TEST_PROFILE_DIR:-$HOME/Library/Application Support/$APP_NAME-test-profile}"

# Why: Electron keys the single-instance lock on userData, so the owning process is readable from
# `<profile>/SingletonLock`, a symlink to "<hostname>-<pid>".
profile_lock_pid() {
  lock_target="$(readlink "$1/SingletonLock" 2>/dev/null || true)"
  [ -n "$lock_target" ] || return 1
  lock_pid="${lock_target##*-}"
  case "$lock_pid" in
    ''|*[!0-9]*) return 1 ;;
  esac
  kill -0 "$lock_pid" 2>/dev/null || return 1
  # Why: a recycled pid must not read as a running instance, so match the app executable, not a bare name.
  ps -p "$lock_pid" -o command= 2>/dev/null | grep -qF "Contents/MacOS/$APP_EXECUTABLE" || return 1
  printf '%s' "$lock_pid"
}

USE_ISOLATED_PROFILE=0
case "$LAUNCH_MODE" in
  isolated)
    USE_ISOLATED_PROFILE=1
    ;;
  shared)
    if [ -n "$(profile_lock_pid "$SHARED_PROFILE_DIR" || true)" ]; then
      echo "[build-test] warning: another $APP_NAME instance owns $SHARED_PROFILE_DIR;" >&2
      echo "[build-test] this --shared launch will exit without a window (--isolated runs both)" >&2
    fi
    ;;
  auto)
    if [ -n "${ORCA_E2E_USER_DATA_DIR:-}" ]; then
      echo "[build-test] honoring caller-provided ORCA_E2E_USER_DATA_DIR=$ORCA_E2E_USER_DATA_DIR"
    else
      PROFILE_LOCK_PID="$(profile_lock_pid "$SHARED_PROFILE_DIR" || true)"
      if [ -n "$PROFILE_LOCK_PID" ]; then
        USE_ISOLATED_PROFILE=1
        echo "[build-test] another $APP_NAME instance (pid $PROFILE_LOCK_PID) owns $SHARED_PROFILE_DIR"
        echo "[build-test] launching with an isolated profile so that instance keeps running"
      fi
    fi
    ;;
esac

# Why: a lost single-instance lock kills the launch before any window exists, which reads as a crash
# with no report anywhere; surface it instead of leaving a silent flash.
report_detached_launch() {
  launch_pid="$1"
  launch_log="$2"
  sleep 3
  if kill -0 "$launch_pid" 2>/dev/null; then
    echo "[build-test] launched pid=$launch_pid"
    return 0
  fi
  echo "[build-test] the packaged app exited immediately; log: $launch_log" >&2
  if [ -f "$launch_log" ]; then
    tail -n 20 "$launch_log" >&2
  fi
  return 1
}

if [ "$USE_ISOLATED_PROFILE" = "1" ]; then
  # Why: HOME must match ORCA_E2E_HOME_DIR, or startup refuses the profile outside its disposable home.
  ISOLATED_HOME="$ISOLATED_PROFILE_DIR/home"
  ISOLATED_USER_DATA="$ISOLATED_PROFILE_DIR/userData"
  mkdir -p "$ISOLATED_HOME" "$ISOLATED_USER_DATA"
  LOG_PATH="${ORCB_TEST_LAUNCH_LOG:-${TMPDIR:-/tmp}/orcb-test-launch.log}"
  mkdir -p "$(dirname "$LOG_PATH")"
  echo "[build-test] isolated profile: $ISOLATED_PROFILE_DIR (holds none of the installed repos or worktrees)"
  # Why: the off-screen flag is one optional env assignment, so build the env argv positionally.
  if [ "${ORCA_BACKGROUND_LAUNCH:-0}" = "1" ]; then
    set -- ORCA_BACKGROUND_LAUNCH=1
    echo "[build-test] launching off screen; log: $LOG_PATH"
  else
    set --
    echo "[build-test] launching detached (open cannot pass the isolated profile); log: $LOG_PATH"
  fi
  # Why: -u so a shell-exported ORCA_BYPASS_SINGLE_INSTANCE_LOCK cannot hand this profile to a second process.
  nohup env -u ORCA_BYPASS_SINGLE_INSTANCE_LOCK "$@" \
    HOME="$ISOLATED_HOME" \
    ORCA_E2E_HOME_DIR="$ISOLATED_HOME" \
    ORCA_E2E_USER_DATA_DIR="$ISOLATED_USER_DATA" \
    "$APP_EXECUTABLE_PATH" >"$LOG_PATH" 2>&1 &
  report_detached_launch "$!" "$LOG_PATH" || exit 1
elif [ "${ORCA_BACKGROUND_LAUNCH:-0}" = "1" ]; then
  LOG_PATH="${ORCB_TEST_LAUNCH_LOG:-${TMPDIR:-/tmp}/orcb-test-launch.log}"
  mkdir -p "$(dirname "$LOG_PATH")"
  echo "[build-test] launching in background; log: $LOG_PATH"
  nohup env ORCA_BACKGROUND_LAUNCH=1 "$APP_EXECUTABLE_PATH" >"$LOG_PATH" 2>&1 &
  report_detached_launch "$!" "$LOG_PATH" || exit 1
else
  echo "[build-test] launching $APP_PATH"
  open "$APP_PATH"
fi
