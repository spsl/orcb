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

export type OrcaCliChildPathOptions = {
  isPackaged: boolean
  userDataPath: string
  resourcesPath?: string | null
  /** Test seam — production reads the real platform, which is what every branch below assumes. */
  platform?: NodeJS.Platform
}

/** Mutates `env` in place, prepending the directory that makes `orcb` this app's CLI. */
export function prependOrcaCliDirToChildPath(
  env: Record<string, string>,
  opts: OrcaCliChildPathOptions
): void {
  const platform = opts.platform ?? process.platform
  // Why: matches node:path's `delimiter` for the running platform, but stays correct when a test
  // drives a foreign platform through the seam.
  const pathDelimiter = platform === 'win32' ? ';' : delimiter
  // Why: dev mode needs the launcher PATH override so `orcb` resolves to this dev build.
  if (!opts.isPackaged) {
    const devCliBin = join(opts.userDataPath, 'cli', 'bin')
    const inheritedPath = readInheritedPath(env, platform)
    // Why: an empty PATH segment resolves as `.` in some shells (commands run from cwd); avoid a trailing delimiter.
    env[resolvePathEnvKey(env, platform)] = inheritedPath
      ? `${devCliBin}${pathDelimiter}${inheritedPath}`
      : devCliBin
  } else if (opts.resourcesPath && ['darwin', 'linux', 'win32'].includes(platform)) {
    // Why: global CLI registration is optional, but agents in ORCB-managed PTYs must always reach this app's bundled CLI.
    const bundledCliBin = join(opts.resourcesPath, 'bin')
    const inheritedEntries = readInheritedPath(env, platform)
      .split(pathDelimiter)
      .filter((entry) => entry.length > 0 && entry !== bundledCliBin)
    env[resolvePathEnvKey(env, platform)] = [bundledCliBin, ...inheritedEntries].join(
      pathDelimiter
    )
  }
}
