/** This fork is packaged and maintained locally, so it never consumes Orca release updates. */
export const ORCB_APP_UPDATES_ENABLED = false

/** Public shell command owned by the ORCB distribution. */
export const ORCB_CLI_COMMAND_NAME = 'orcb'

/** Development-only counterpart of the public ORCB shell command. */
export const ORCB_DEV_CLI_COMMAND_NAME = 'orcb-dev'

type OrcbCliInvocationEnvironment = Partial<
  Record<'ORCA_CLI_COMMAND' | 'ORCA_DEV_CLI_INVOCATION' | 'ORCA_USER_DATA_PATH', string>
>

export function isOrcbDevCliInvocation(env: OrcbCliInvocationEnvironment): boolean {
  return (
    env.ORCA_DEV_CLI_INVOCATION === '1' ||
    (env.ORCA_USER_DATA_PATH?.includes(ORCB_DEV_CLI_COMMAND_NAME) ?? false)
  )
}

export function resolveOrcbCliCommandName(
  env: OrcbCliInvocationEnvironment
): typeof ORCB_CLI_COMMAND_NAME | typeof ORCB_DEV_CLI_COMMAND_NAME {
  const configured = env.ORCA_CLI_COMMAND
  if (configured === ORCB_CLI_COMMAND_NAME || configured === ORCB_DEV_CLI_COMMAND_NAME) {
    return configured
  }
  return isOrcbDevCliInvocation(env) ? ORCB_DEV_CLI_COMMAND_NAME : ORCB_CLI_COMMAND_NAME
}
