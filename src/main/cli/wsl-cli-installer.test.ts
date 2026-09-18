import type { CliInstallStatus } from '../../shared/cli-install-types'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runWslProcessMock = vi.hoisted(() => vi.fn())

vi.mock('../wsl/wsl-runner', () => ({
  runWslProcess: runWslProcessMock
}))

import { WslCliInstaller, _internals } from './wsl-cli-installer'
import { reconcileManagedWslCliRegistrations } from './wsl-cli-registration-reconciliation'

const ORCB_WSL_COMMAND_PATH = '/home/alice/.local/bin/orcb'
const ORCB_WSL_BRIDGE_PATH = '/home/alice/.local/share/orcb/orcb-wsl-bridge.ps1'
const ORCB_WINDOWS_LAUNCHER =
  'C:\\Users\\me\\AppData\\Local\\Programs\\orcb\\resources\\bin\\orcb.exe'

function makeHostStatus(launcherPath = ORCB_WINDOWS_LAUNCHER) {
  return {
    platform: 'win32',
    commandName: 'orcb',
    commandPath: launcherPath,
    pathDirectory: 'C:\\Users\\me\\AppData\\Local\\Programs\\orcb\\resources\\bin',
    pathConfigured: true,
    launcherPath,
    installMethod: 'wrapper',
    supported: true,
    state: 'installed',
    currentTarget: launcherPath,
    unsupportedReason: null,
    detail: null
  } satisfies CliInstallStatus
}

// A pre-ORCB official Orca launcher must never be adopted or removed by ORCB.
const LEGACY_ORCA_MANAGED_WSL_LAUNCHER = `#!/usr/bin/env bash
set -euo pipefail
# Orca managed WSL CLI launcher
# ORCA_WIN_LAUNCHER_B64=QzpcUHJvZ3JhbSBGaWxlc1xPcmNhXHJlc291cmNlc1xiaW5cb3JjYS5jbWQ=
ORCA_WIN_LAUNCHER='C:\\Program Files\\Orca\\resources\\bin\\orca.cmd'
ORCA_BRIDGE_PS1='/home/alice/.local/share/orca/orca-wsl-bridge.ps1'
if command -v powershell.exe >/dev/null 2>&1; then
  ORCA_POWERSHELL=powershell.exe
elif [ -x /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe ]; then
  ORCA_POWERSHELL=/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe
else
  echo "Orca WSL CLI requires Windows interop and could not find powershell.exe." >&2
  exit 1
fi
ORCA_BRIDGE_PS1_WIN=$(wslpath -w "$ORCA_BRIDGE_PS1")
exec "$ORCA_POWERSHELL" -NoProfile -ExecutionPolicy Bypass -File "$ORCA_BRIDGE_PS1_WIN" "$ORCA_WIN_LAUNCHER" "$@"
`

function buildStaleOrcbLauncher(
  windowsLauncher = 'C:\\Users\\me\\AppData\\Local\\Programs\\orcb\\bin\\orcb.cmd'
): string {
  return _internals.buildWslLauncher(windowsLauncher, ORCB_WSL_BRIDGE_PATH)
}

function createWslRunner(
  initialFile: string | null = null,
  pathIncludesLocalBin = true,
  options: {
    initialBridge?: string | null
    initialLegacyFile?: string | null
    failInstall?: boolean
    interopReady?: boolean
  } = {}
) {
  const commandPath = ORCB_WSL_COMMAND_PATH
  const legacyCommandPath = '/home/alice/.local/bin/orca'
  const bridgePath = ORCB_WSL_BRIDGE_PATH
  const files = new Map<string, string>()
  if (initialFile !== null) {
    files.set(commandPath, initialFile)
  }
  if (
    options.initialBridge !== null &&
    (initialFile !== null || options.initialBridge !== undefined)
  ) {
    files.set(bridgePath, options.initialBridge ?? _internals.buildWslBridgeScript())
  }
  if (options.initialLegacyFile) {
    files.set(legacyCommandPath, options.initialLegacyFile)
  }
  const calls: string[] = []
  const runner = vi.fn(async (_distro: string, command: string) => {
    calls.push(command)
    if (command.includes('printf %s "$HOME"')) {
      return '/home/alice'
    }
    if (command.includes('case ":$PATH:"')) {
      return pathIncludesLocalBin ? 'yes' : 'no'
    }
    if (command.includes('cat > "$command_tmp"')) {
      if (options.failInstall) {
        throw new Error('simulated replacement failure')
      }
      if (
        files.has(bridgePath) &&
        !files.get(bridgePath)?.includes('# ORCB managed WSL CLI PowerShell bridge')
      ) {
        throw new Error('__ORCA_CONFLICT__')
      }
      const launcher =
        command.match(/cat > "\$command_tmp" <<'ORCA_WSL_CLI'\n([\s\S]*)\nORCA_WSL_CLI/)?.[1] ?? ''
      const bridge =
        command.match(
          /cat > "\$bridge_tmp" <<'ORCA_WSL_BRIDGE'\n([\s\S]*)\nORCA_WSL_BRIDGE/
        )?.[1] ?? ''
      files.set(commandPath, launcher)
      files.set(bridgePath, bridge)
      return ''
    }
    if (command.includes('command -v powershell.exe')) {
      return options.interopReady === false ? 'no' : 'yes'
    }
    if (command.includes('rm -f')) {
      if (command.includes(`rm -f '${commandPath}'`)) {
        if (
          files.has(bridgePath) &&
          !files.get(bridgePath)?.includes('# ORCB managed WSL CLI PowerShell bridge')
        ) {
          throw new Error('__ORCA_CONFLICT__')
        }
        files.delete(commandPath)
        files.delete(bridgePath)
      }
      return ''
    }
    if (command.includes('cat ')) {
      if (command.includes(commandPath)) {
        return files.get(commandPath) ?? '__ORCA_MISSING__'
      }
      if (command.includes(bridgePath)) {
        return files.get(bridgePath) ?? '__ORCA_MISSING__'
      }
      if (command.includes(legacyCommandPath)) {
        return files.get(legacyCommandPath) ?? '__ORCA_MISSING__'
      }
    }
    throw new Error(`Unexpected WSL command: ${command}`)
  })
  return {
    runner,
    calls,
    getBridge: () => files.get(bridgePath) ?? null,
    getFile: () => files.get(commandPath) ?? null,
    getLegacyFile: () => files.get(legacyCommandPath) ?? null
  }
}

describe('WslCliInstaller', () => {
  beforeEach(() => {
    runWslProcessMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('installs a WSL launcher that forwards to the Windows ORCB launcher', async () => {
    const wsl = createWslRunner()
    const installer = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus() },
      wslRunner: wsl.runner
    })

    await expect(installer.getStatus()).resolves.toMatchObject({
      state: 'not_installed',
      commandPath: ORCB_WSL_COMMAND_PATH
    })

    const installed = await installer.install()

    expect(installed).toMatchObject({
      state: 'installed',
      pathConfigured: true,
      launcherPath: ORCB_WINDOWS_LAUNCHER
    })
    expect(wsl.getFile()).toBe(
      _internals.buildWslLauncher(
        ORCB_WINDOWS_LAUNCHER,
        ORCB_WSL_BRIDGE_PATH
      )
    )
    expect(wsl.getBridge()).toBe(_internals.buildWslBridgeScript())
    const installCommand = wsl.calls.find((command) => command.includes('cat > "$command_tmp"'))
    expect(installCommand).toBeDefined()
    expect(installCommand).not.toContain('legacy_command_path')
    expect(installCommand).not.toContain("'/home/alice/.local/bin/orca'")
    // Publishing the bridge first keeps interrupted ORCB upgrades usable.
    const bridgePublishIndex = installCommand?.indexOf('mv -f "$bridge_tmp"') ?? -1
    const launcherPublishIndex = installCommand?.indexOf('mv -f "$command_tmp"') ?? -1
    expect(bridgePublishIndex).toBeGreaterThan(-1)
    expect(bridgePublishIndex).toBeLessThan(launcherPublishIndex)
  })

  it('continues checking WSL when the host launcher exists but host PATH is unknown', async () => {
    const wsl = createWslRunner()
    const hostStatus = {
      ...makeHostStatus(),
      pathConfigured: null,
      detail: 'ORCB could not read the Windows user PATH registry value.'
    } satisfies CliInstallStatus
    const installer = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => hostStatus },
      wslRunner: wsl.runner
    })

    await expect(installer.getStatus()).resolves.toMatchObject({
      supported: true,
      state: 'not_installed',
      commandPath: ORCB_WSL_COMMAND_PATH
    })
  })

  it('derives the WSL bridge path in ORCB namespace', () => {
    expect(_internals.getBridgePathFromCommandPath(ORCB_WSL_COMMAND_PATH)).toBe(
      ORCB_WSL_BRIDGE_PATH
    )
  })

  it('reports installed WSL launchers whose bin directory is missing from PATH', async () => {
    const launcher = _internals.buildWslLauncher(
      'C:\\orcb\\orcb.cmd',
      ORCB_WSL_BRIDGE_PATH
    )
    const wsl = createWslRunner(launcher, false)
    const installer = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus('C:\\orcb\\orcb.cmd') },
      wslRunner: wsl.runner
    })

    await expect(installer.getStatus()).resolves.toMatchObject({
      state: 'installed',
      pathConfigured: false,
      detail: expect.stringContaining('not on PATH')
    })
  })

  it('accepts current managed WSL scripts with an extra heredoc trailing newline', async () => {
    const launcher = `${_internals.buildWslLauncher(
      'C:\\orcb\\orcb.cmd',
      ORCB_WSL_BRIDGE_PATH
    )}\n`
    const wsl = createWslRunner(launcher)
    const installer = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus('C:\\orcb\\orcb.cmd') },
      wslRunner: async (distro, command) => {
        if (command.includes(`cat ${ORCB_WSL_BRIDGE_PATH}`)) {
          return `${_internals.buildWslBridgeScript()}\n`
        }
        return wsl.runner(distro, command)
      }
    })

    await expect(installer.getStatus()).resolves.toMatchObject({
      state: 'installed',
      currentTarget: 'C:\\orcb\\orcb.cmd'
    })
  })

  it('refuses to replace an unmanaged WSL command', async () => {
    const wsl = createWslRunner('#!/usr/bin/env bash\necho elsewhere\n')
    const installer = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus() },
      wslRunner: wsl.runner
    })

    await expect(installer.getStatus()).resolves.toMatchObject({ state: 'conflict' })
    await expect(installer.install()).rejects.toThrow('Refusing to replace')
  })

  it('removes a managed WSL launcher', async () => {
    const wsl = createWslRunner(
      _internals.buildWslLauncher(
        'C:\\orcb\\orcb.cmd',
        ORCB_WSL_BRIDGE_PATH
      )
    )
    const installer = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus('C:\\orcb\\orcb.cmd') },
      wslRunner: wsl.runner
    })

    await expect(installer.remove()).resolves.toMatchObject({ state: 'not_installed' })
    expect(wsl.getFile()).toBeNull()
  })

  it('generates a launcher that forwards arguments through a PowerShell file bridge', () => {
    const launcher = _internals.buildWslLauncher(
      'C:\\Program Files\\orcb\\resources\\bin\\orcb.exe',
      ORCB_WSL_BRIDGE_PATH
    )
    const bridge = _internals.buildWslBridgeScript()

    expect(launcher).toContain('command -v powershell.exe')
    expect(launcher).toContain('/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe')
    expect(launcher).toContain(
      'ORCB WSL CLI requires Windows interop and could not find powershell.exe.'
    )
    expect(launcher).toContain('"$ORCA_POWERSHELL" -NoProfile -ExecutionPolicy Bypass -File')
    expect(launcher).toContain('ORCA_WSL_CWD=$(pwd -P 2>/dev/null) || {')
    expect(launcher).toContain('ORCA_WSL_CWD=/')
    expect(launcher).toContain('cd /')
    expect(launcher).toContain('ORCA_WSL_CWD_WIN=$(wslpath -w "$ORCA_WSL_CWD")')
    expect(launcher.indexOf('ORCA_WSL_CWD=$(pwd -P')).toBeLessThan(
      launcher.indexOf('ORCA_BRIDGE_PS1_WIN=$(wslpath')
    )
    expect(launcher).toContain('"$ORCA_WIN_LAUNCHER" -WslCwd "$ORCA_WSL_CWD_WIN" "$@"')
    expect(launcher).not.toContain('-Command')
    expect(bridge).not.toContain('[CmdletBinding')
    expect(bridge).not.toMatch(/^param\(/m)
    expect(bridge).toContain("$args[1] -eq '-WslCwd'")
    expect(bridge).toContain('[string]$OrcaLauncher = $args[0]')
    expect(bridge).toContain('$WslCwd = $args[2]')
    expect(bridge).toContain('$ForwardArgs = @($args[$ForwardArgStart..($args.Count - 1)])')
    expect(bridge).toContain('if ([string]::IsNullOrEmpty($WslCwd))')
    expect(bridge).toContain('$env:ORCA_CLI_CWD = $WslCwd')
    expect(bridge).toContain('$LauncherDirectory = Split-Path -Parent $OrcaLauncher')
    expect(bridge).toContain('Push-Location -LiteralPath $LauncherDirectory')
    // Why (#16463): Push-Location moves only the PowerShell provider location.
    // Without an explicit WorkingDirectory the started app inherits the caller's
    // Win32 cwd — the user's worktree on \\wsl.localhost — and every wsl.exe
    // spawn it makes dies with ENOENT once that worktree is removed.
    expect(bridge).toContain('$StartInfo.WorkingDirectory = $LauncherDirectory')
    expect(bridge).toContain('function ConvertTo-NativeCommandLineArgument')
    expect(bridge).toContain("[void]$Quoted.Append([char]'\\', $BackslashCount * 2 + 1)")
    expect(bridge).toContain('$StartInfo.UseShellExecute = $false')
    expect(bridge).toContain('[System.Diagnostics.Process]::Start($StartInfo)')
    expect(bridge).toContain('$Process.WaitForExit()')
    expect(bridge).toContain('$exitCode = $Process.ExitCode')
    expect(bridge).not.toContain('& $OrcaLauncher @ForwardArgs')
    expect(bridge).toContain('Remove-Item Env:ORCA_CLI_CWD -ErrorAction SilentlyContinue')
    expect(bridge).toContain('catch')
    expect(bridge).toContain('$exitCode = 1')
    expect(bridge).toContain('exit $exitCode')
  })

  it('treats absolute Windows PowerShell as interop-ready when powershell.exe is missing from PATH', async () => {
    const wsl = createWslRunner()
    const installer = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus() },
      wslRunner: async (distro, command) => {
        if (command.includes('command -v powershell.exe') && !command.includes('cat >')) {
          expect(command).toContain('/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe')
          return 'yes'
        }
        return wsl.runner(distro, command)
      }
    })

    await expect(installer.getStatus()).resolves.toMatchObject({
      state: 'not_installed',
      commandPath: ORCB_WSL_COMMAND_PATH
    })
  })

  it('marks stale managed launchers that point at the old app bin instead of packaged resources', async () => {
    const oldLauncher = _internals.buildWslLauncher(
      'C:\\Users\\me\\AppData\\Local\\Programs\\orcb\\bin\\orcb.cmd',
      ORCB_WSL_BRIDGE_PATH
    )
    const wsl = createWslRunner(oldLauncher)
    const installer = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus() },
      wslRunner: wsl.runner
    })

    await expect(installer.getStatus()).resolves.toMatchObject({
      state: 'stale',
      currentTarget: 'C:\\Users\\me\\AppData\\Local\\Programs\\orcb\\bin\\orcb.cmd',
      launcherPath: ORCB_WINDOWS_LAUNCHER
    })

    await expect(installer.install()).resolves.toMatchObject({
      state: 'installed',
      currentTarget: ORCB_WINDOWS_LAUNCHER
    })
  })

  it('does not adopt an official Orca registration during automatic reconciliation', async () => {
    const wsl = createWslRunner(null, true, {
      initialLegacyFile: LEGACY_ORCA_MANAGED_WSL_LAUNCHER
    })
    const installer = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus() },
      wslRunner: wsl.runner
    })
    const recordObservations = vi.fn(async () => undefined)

    await expect(
      reconcileManagedWslCliRegistrations({
        platform: 'win32',
        isPackaged: true,
        userDataPath: '/user-data',
        listDistros: async () => ['Ubuntu'],
        registry: {
          getCandidates: async () => ['Ubuntu'],
          recordObservations
        },
        createInstaller: () => installer
      })
    ).resolves.toEqual([
      { distro: 'Ubuntu', outcome: 'unchanged', state: 'not_installed', managed: false }
    ])
    expect(wsl.getFile()).toBeNull()
    expect(wsl.getLegacyFile()).toBe(LEGACY_ORCA_MANAGED_WSL_LAUNCHER)
    expect(wsl.calls.some((command) => command.includes('cat > "$command_tmp"'))).toBe(false)
    expect(recordObservations).toHaveBeenCalledWith([
      { distro: 'Ubuntu', inspected: true, managed: false, reconciled: null }
    ])
  })

  it('leaves unmanaged WSL commands and conflicting bridges untouched during automatic repair', async () => {
    const unmanaged = '#!/usr/bin/env bash\necho user-owned\n'
    const wsl = createWslRunner(unmanaged)
    const installer = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus() },
      wslRunner: wsl.runner
    })

    await expect(installer.repairManagedRegistration()).resolves.toMatchObject({
      changed: false,
      status: { state: 'conflict' }
    })
    expect(wsl.getFile()).toBe(unmanaged)
    expect(wsl.calls.some((command) => command.includes('cat > "$command_tmp"'))).toBe(false)
  })

  it('repairs a managed launcher whose bridge is missing, but preserves a conflicting bridge', async () => {
    const nativeLauncher = 'C:\\orcb\\resources\\bin\\orcb.exe'
    const staleLauncher = buildStaleOrcbLauncher()
    const missingBridge = createWslRunner(staleLauncher, true, {
      initialBridge: null
    })
    const missingBridgeInstaller = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus(nativeLauncher) },
      wslRunner: missingBridge.runner
    })

    await expect(missingBridgeInstaller.repairManagedRegistration()).resolves.toMatchObject({
      changed: true,
      status: { state: 'installed' }
    })
    expect(missingBridge.getBridge()).toBe(_internals.buildWslBridgeScript())

    const staleBridge = createWslRunner(staleLauncher, true, {
      initialBridge: '# ORCB managed WSL CLI PowerShell bridge\nWrite-Output "stale"\n'
    })
    const staleBridgeInstaller = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus(nativeLauncher) },
      wslRunner: staleBridge.runner
    })
    await expect(staleBridgeInstaller.repairManagedRegistration()).resolves.toMatchObject({
      changed: true,
      status: { state: 'installed' }
    })
    expect(staleBridge.getBridge()).toBe(_internals.buildWslBridgeScript())

    const conflictingBridge = createWslRunner(staleLauncher, true, {
      initialBridge: 'Write-Output "user-owned bridge"\n'
    })
    const conflictingBridgeInstaller = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus(nativeLauncher) },
      wslRunner: conflictingBridge.runner
    })

    // Why: a stale launcher with a user-owned bridge must surface as a
    // non-throwing conflict, not retry a doomed install on every startup.
    await expect(conflictingBridgeInstaller.repairManagedRegistration()).resolves.toMatchObject({
      changed: false,
      managed: true,
      status: { state: 'conflict' }
    })
    expect(conflictingBridge.getBridge()).toBe('Write-Output "user-owned bridge"\n')
    expect(conflictingBridge.getFile()).toBe(staleLauncher)
    expect(
      conflictingBridge.calls.some((command) => command.includes('cat > "$command_tmp"'))
    ).toBe(false)
  })

  it('retains command ownership when only the bridge conflicts', async () => {
    const nativeLauncher = 'C:\\orcb\\resources\\bin\\orcb.exe'
    const currentLauncher = _internals.buildWslLauncher(
      nativeLauncher,
      ORCB_WSL_BRIDGE_PATH
    )
    const wsl = createWslRunner(currentLauncher, true, {
      initialBridge: 'Write-Output "user-owned bridge"\n'
    })
    const installer = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus(nativeLauncher) },
      wslRunner: wsl.runner
    })

    await expect(installer.repairManagedRegistration()).resolves.toMatchObject({
      changed: false,
      managed: true,
      status: { state: 'conflict' }
    })
    expect(wsl.getBridge()).toBe('Write-Output "user-owned bridge"\n')
    expect(wsl.getFile()).toBe(currentLauncher)
  })

  it('leaves an official Orca registration untouched during repair', async () => {
    const legacy = createWslRunner(null, true, {
      initialLegacyFile: LEGACY_ORCA_MANAGED_WSL_LAUNCHER
    })
    const installer = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus() },
      wslRunner: legacy.runner
    })

    await expect(installer.repairManagedRegistration()).resolves.toMatchObject({
      changed: false,
      managed: false,
      status: { state: 'not_installed' }
    })
    expect(legacy.getFile()).toBeNull()
    expect(legacy.getLegacyFile()).toBe(LEGACY_ORCA_MANAGED_WSL_LAUNCHER)
    expect(legacy.calls.some((command) => command.includes('cat > "$command_tmp"'))).toBe(false)
  })

  it('removes only ORCB registration and leaves an official Orca command untouched', async () => {
    const nativeLauncher = 'C:\\orcb\\resources\\bin\\orcb.exe'
    const installedWithLegacy = createWslRunner(
      _internals.buildWslLauncher(nativeLauncher, ORCB_WSL_BRIDGE_PATH),
      true,
      { initialLegacyFile: LEGACY_ORCA_MANAGED_WSL_LAUNCHER }
    )
    const installedInstaller = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus(nativeLauncher) },
      wslRunner: installedWithLegacy.runner
    })
    await expect(installedInstaller.remove()).resolves.toMatchObject({ state: 'not_installed' })
    expect(installedWithLegacy.getFile()).toBeNull()
    expect(installedWithLegacy.getLegacyFile()).toBe(LEGACY_ORCA_MANAGED_WSL_LAUNCHER)
  })

  it('keeps stale ORCB files on a transactional replacement failure', async () => {
    const bridge = _internals.buildWslBridgeScript()
    const staleLauncher = buildStaleOrcbLauncher()
    const wsl = createWslRunner(staleLauncher, true, {
      initialBridge: bridge,
      failInstall: true
    })
    const installer = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: {
        getStatus: async () => makeHostStatus('C:\\Program Files\\orcb\\resources\\bin\\orcb.exe')
      },
      wslRunner: wsl.runner
    })

    await expect(installer.repairManagedRegistration()).rejects.toThrow(
      'simulated replacement failure'
    )
    expect(wsl.getFile()).toBe(staleLauncher)
    expect(wsl.getBridge()).toBe(bridge)
    const installCommand = wsl.calls.find((command) => command.includes('cat > "$command_tmp"'))
    expect(installCommand).toContain('rollback() {')
    expect(installCommand).toContain('set +e')
    expect(installCommand).toContain('bridge_backup="${bridge_tmp}.backup"')
    expect(installCommand).toContain('cp -p')
    expect(installCommand).toContain('elif [ "$bridge_touched" -eq 1 ]')
    expect(installCommand).toContain('committed=1')
    expect(installCommand).toContain('flock -x -w 30 9')
    // Why: the command replace must stay one atomic rename; a mv-based backup
    // would leave a window where a concurrent shell finds no orcb at all.
    expect(installCommand).not.toContain('command_backup')
    expect(installCommand).not.toContain(`mv -f '${ORCB_WSL_COMMAND_PATH}'`)
  })

  it.skipIf(process.platform === 'win32')(
    'rolls both files back when the command replacement fails after the bridge move',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'orcb-wsl-cli-rollback-'))
      const home = join(root, 'home with spaces')
      const commandPath = join(home, '.local', 'bin', 'orcb')
      const bridgePath = join(home, '.local', 'share', 'orcb', 'orcb-wsl-bridge.ps1')
      const bridge = _internals.buildWslBridgeScript()
      const staleLauncher = _internals.buildWslLauncher(
        'C:\\Program Files\\orcb\\bin\\orcb.cmd',
        bridgePath
      )
      await mkdir(join(home, '.local', 'bin'), { recursive: true })
      await mkdir(join(home, '.local', 'share', 'orcb'), { recursive: true })
      await writeFile(commandPath, staleLauncher, 'utf8')
      await writeFile(bridgePath, bridge, 'utf8')

      const runner = async (_distro: string, command: string): Promise<string> => {
        if (command.includes('printf %s "$HOME"')) {
          return home
        }
        if (command.includes('cat > "$command_tmp"')) {
          const executableCommand = command
            .split('\n')
            .map((line) => (line.startsWith('mv -f "$command_tmp" ') ? 'exit 71' : line))
            .join('\n')
          return execFileSync('bash', ['-c', executableCommand], { encoding: 'utf8' })
        }
        if (command.includes('command -v powershell.exe')) {
          return 'yes'
        }
        if (command.includes('case ":$PATH:"')) {
          return 'yes'
        }
        return execFileSync('bash', ['-c', command], { encoding: 'utf8' })
      }
      const installer = new WslCliInstaller({
        platform: 'win32',
        distro: 'Ubuntu',
        hostInstaller: {
          getStatus: async () => makeHostStatus('C:\\Program Files\\orcb\\resources\\bin\\orcb.exe')
        },
        wslRunner: runner
      })

      try {
        await expect(installer.repairManagedRegistration()).rejects.toThrow()
        await expect(readFile(commandPath, 'utf8')).resolves.toBe(staleLauncher)
        await expect(readFile(bridgePath, 'utf8')).resolves.toBe(bridge)
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    }
  )

  it('skips automatic repair when WSL interop is unavailable', async () => {
    const staleLauncher = buildStaleOrcbLauncher()
    const wsl = createWslRunner(staleLauncher, true, { interopReady: false })
    const installer = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus() },
      wslRunner: wsl.runner
    })

    await expect(installer.repairManagedRegistration()).resolves.toMatchObject({
      changed: false,
      status: { state: 'unsupported' }
    })
    expect(wsl.getFile()).toBe(staleLauncher)
  })

  it('is idempotent after repairing a stale ORCB registration', async () => {
    const nativeLauncher = 'D:\\Custom orcb\\resources\\bin\\orcb.exe'
    const wsl = createWslRunner(buildStaleOrcbLauncher())
    const installer = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus(nativeLauncher) },
      wslRunner: wsl.runner
    })

    await expect(installer.repairManagedRegistration()).resolves.toMatchObject({ changed: true })
    await expect(installer.repairManagedRegistration()).resolves.toMatchObject({ changed: false })
    expect(wsl.calls.filter((command) => command.includes('cat > "$command_tmp"'))).toHaveLength(1)
    expect(wsl.getFile()).toContain("ORCA_WIN_LAUNCHER='D:\\Custom orcb\\resources\\bin\\orcb.exe'")
  })

  it('settles when wsl.exe never reports completion', async () => {
    // Why no fake timers: the timeout is now runProcess's own, internal to the
    // mocked runWslProcess -- there is nothing left here to advance.
    runWslProcessMock.mockResolvedValue({ code: null, stdout: '', stderr: '', timedOut: true })
    const installer = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus() }
    })

    await expect(installer.getStatus()).rejects.toThrow('WSL command timed out')
  })

  it('reports the distro unreachable rather than "not on PATH" without the login PATH', async () => {
    // The `case ":$PATH:"` probe answers from the distro default PATH when the
    // login PATH never resolved, and ~/.local/bin is never on that. Settings
    // would then state as fact that the CLI is not on PATH while the user's
    // own terminal finds it -- #14288 turning into a confident wrong verdict.
    runWslProcessMock.mockResolvedValue({
      environmentResolved: false,
      code: 0,
      stdout: 'no',
      stderr: '',
      timedOut: false
    })
    const installer = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus() }
    })

    await expect(installer.getStatus()).rejects.toThrow('Could not reach the WSL distro')
  })

  it('refuses to remove an ORCB managed launcher when the bridge path is user-owned', async () => {
    const oldLauncher = buildStaleOrcbLauncher('C:\\Old\\orcb.cmd')
    const wsl = createWslRunner(oldLauncher)
    const installer = new WslCliInstaller({
      platform: 'win32',
      distro: 'Ubuntu',
      hostInstaller: { getStatus: async () => makeHostStatus('C:\\orcb\\orcb.cmd') },
      wslRunner: async (distro, command) => {
        if (command.includes(`cat ${ORCB_WSL_BRIDGE_PATH}`)) {
          return 'user bridge'
        }
        if (command.includes('rm -f')) {
          throw new Error('__ORCA_CONFLICT__')
        }
        return wsl.runner(distro, command)
      }
    })

    await expect(installer.remove()).rejects.toThrow('__ORCA_CONFLICT__')
  })
})
