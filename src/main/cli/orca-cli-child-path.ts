/**
 * The PATH entry through which an ORCB-launched child reaches THIS app's own CLI.
 *
 * Extracted from `buildPtyHostEnv` so the structured-session lane can apply the identical
 * treatment. A structured worker has no PTY, but its provider child runs `orcb orchestration ...`
 * exactly like a PTY worker's agent does. Every packaged platform prepends this app's bundled
 * command, regardless of whether the user registered the CLI globally.
 *
 * `platform` is a test seam only: production leaves it unset and reads `process.platform`, so
 * every branch behaves exactly as it did inside `buildPtyHostEnv`.
 */

import { delimiter, join } from 'node:path'
import { readInheritedPath } from '../ipc/pty/host-env/path'
import { resolvePathEnvKey } from '../pty/windows-environment-path'
import { getBundledLauncherPath } from './bundled-cli-launcher-path'
import { DEV_COMMAND_NAME } from './cli-install-constants'

export type OrcaCliChildPathOptions = {
  isPackaged: boolean
  userDataPath: string
  resourcesPath?: string | null
  /** Test seam — production reads the real platform, which is what every branch below assumes. */
  platform?: NodeJS.Platform
}

/**
 * Mutates `env` in place, prepending the directory that makes `orcb` this app's CLI. Returns
 * the absolute launcher in that directory, or null when none was prepended: a child whose shell
 * rebuilds PATH (a login shell reordering it behind a global install) can still name this app's
 * CLI by path.
 */
export function prependOrcaCliDirToChildPath(
  env: Record<string, string>,
  opts: OrcaCliChildPathOptions
): string | null {
  const platform = opts.platform ?? process.platform
  delete env.ORCA_CLI_BIN_DIR
  // Why: matches node:path's `delimiter` for the running platform, but stays correct when a test
  // drives a foreign platform through the seam.
  const pathDelimiter = platform === 'win32' ? ';' : delimiter
  // Why: dev mode needs the launcher PATH override so `orcb` resolves to this dev build.
  if (!opts.isPackaged) {
    const devCliBin = join(opts.userDataPath, 'cli', 'bin')
    if (platform !== 'win32') {
      env.ORCA_CLI_BIN_DIR = devCliBin
    }
    const inheritedPath = readInheritedPath(env, platform)
    // Why: an empty PATH segment resolves as `.` in some shells (commands run from cwd); avoid a trailing delimiter.
    env[resolvePathEnvKey(env, platform)] = inheritedPath
      ? `${devCliBin}${pathDelimiter}${inheritedPath}`
      : devCliBin
    return join(devCliBin, platform === 'win32' ? `${DEV_COMMAND_NAME}.cmd` : DEV_COMMAND_NAME)
  } else if (opts.resourcesPath && ['darwin', 'linux', 'win32'].includes(platform)) {
    // Why: global CLI registration is optional, but agents in ORCB-managed PTYs must always reach this app's bundled CLI.
    const bundledCliBin = join(opts.resourcesPath, 'bin')
    if (platform !== 'win32') {
      env.ORCA_CLI_BIN_DIR = bundledCliBin
    }
    const inheritedEntries = readInheritedPath(env, platform)
      .split(pathDelimiter)
      .filter((entry) => entry.length > 0 && entry !== bundledCliBin)
    env[resolvePathEnvKey(env, platform)] = [bundledCliBin, ...inheritedEntries].join(pathDelimiter)
    return getBundledLauncherPath(platform, opts.resourcesPath)
  }
  return null
}
