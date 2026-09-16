import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const EMULATOR_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['emulator', 'list'],
    summary: 'List available/running emulators (Orca-managed + raw serve-sim)',
    usage: 'orcb emulator list [--worktree <selector>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree']
  },
  {
    path: ['emulator', 'devices'],
    summary: 'List all emulator devices/AVDs across iOS and Android',
    usage: 'orcb emulator devices [--worktree <selector>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree']
  },
  {
    path: ['emulator', 'attach'],
    summary: 'Attach/start helper for a device and make it active for the worktree',
    usage: 'orcb emulator attach [device] [--worktree <selector>] [--focus] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree', 'focus', 'device'],
    positionalArgs: ['device']
  },
  {
    path: ['emulator', 'tap'],
    summary: 'Tap at normalized 0..1 coords (preferred for single taps)',
    usage: 'orcb emulator tap <x> <y> [--device <id>] [--worktree <selector>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'device', 'emulator', 'worktree', 'x', 'y'],
    positionalArgs: ['x', 'y']
  },
  {
    path: ['emulator', 'type'],
    summary: 'Type text (US ASCII only)',
    usage: 'orcb emulator type <text> [--device <id>] [--worktree <selector>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'text', 'device', 'emulator', 'worktree'],
    positionalArgs: ['text']
  },
  {
    path: ['emulator', 'gesture'],
    summary: 'Send a multi-point gesture sequence',
    usage: "orcb emulator gesture '<json>' [--device <id>] [--worktree <selector>] [--json]",
    allowedFlags: [...GLOBAL_FLAGS, 'points', 'device', 'emulator', 'worktree'],
    positionalArgs: ['points']
  },
  {
    path: ['emulator', 'button'],
    summary: 'Hardware button (home, side_button, etc.)',
    usage: 'orcb emulator button <name> [--device <id>] [--worktree <selector>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'device', 'emulator', 'worktree', 'name'],
    positionalArgs: ['name']
  },
  {
    path: ['emulator', 'rotate'],
    summary: 'Rotate device',
    usage: 'orcb emulator rotate <orientation> [--device <id>] [--worktree <selector>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'device', 'emulator', 'worktree', 'orientation'],
    positionalArgs: ['orientation']
  },
  {
    path: ['emulator', 'exec'],
    summary:
      'Raw passthrough (e.g. orcb emulator exec --command "tap 0.5 0.7" or "ca-debug blended on")',
    usage: 'orcb emulator exec --command <cmd> [--device <id>] [--worktree <selector>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'command', 'device', 'emulator', 'worktree']
  },
  {
    path: ['emulator', 'kill'],
    summary: 'Stop helper for device',
    usage: 'orcb emulator kill [--device <id>] [--worktree <selector>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'device', 'emulator', 'worktree']
  },
  {
    path: ['emulator', 'shutdown'],
    summary: 'Stop helper and shut down the simulator device',
    usage:
      'orcb emulator shutdown [--device <id>] [--emulator <id>] [--worktree <selector>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'device', 'emulator', 'worktree']
  },
  {
    path: ['emulator', 'install'],
    summary: 'Install an APK onto the target Android device',
    usage: 'orcb emulator install <apkPath> [--reinstall] [--device <id>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'device', 'emulator', 'worktree', 'path', 'reinstall'],
    positionalArgs: ['path']
  },
  {
    path: ['emulator', 'launch'],
    summary: 'Launch an Android app by package (and optional activity)',
    usage: 'orcb emulator launch <package> [--activity <name>] [--device <id>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'device', 'emulator', 'worktree', 'package', 'activity'],
    positionalArgs: ['package']
  },
  {
    path: ['emulator', 'permissions'],
    summary: 'Grant/revoke an Android runtime permission, or reset all runtime grants',
    usage:
      'orcb emulator permissions <grant|revoke> <package> <permission> [--device <id>] [--json]\n       orcb emulator permissions reset [--device <id>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'device',
      'emulator',
      'worktree',
      'op',
      'package',
      'permission'
    ],
    positionalArgs: ['op', 'package', 'permission']
  },
  {
    path: ['emulator', 'ax'],
    summary: 'Dump the accessibility tree (Android uiautomator; iOS serve-sim AX, frames 0..1)',
    usage: 'orcb emulator ax [--device <id>] [--worktree <selector>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'device', 'emulator', 'worktree']
  },
  {
    path: ['emulator', 'logcat'],
    summary: 'Capture a one-shot logcat dump from the Android device',
    usage: 'orcb emulator logcat [--lines <n>] [--device <id>] [--worktree <selector>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'device', 'emulator', 'worktree', 'lines']
  }
]
