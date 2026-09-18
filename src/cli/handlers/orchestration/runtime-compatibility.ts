import { RuntimeClientError } from '../../runtime-client'
import {
  ORCB_CLI_COMMAND_NAME,
  ORCB_DEV_CLI_COMMAND_NAME,
  isOrcbDevCliInvocation,
  resolveOrcbCliCommandName
} from '../../../shared/orcb-local-distribution'

export function resolveCompatibilityCliCommand(): 'orca' | 'orca-ide' | 'orca-dev' {
  const configured = process.env.ORCA_CLI_COMMAND
  if (configured === 'orca' || configured === 'orca-ide' || configured === 'orca-dev') {
    return configured
  }
  return process.platform === 'linux' ? 'orca-ide' : 'orca'
}

export function resolveOrcbCompatibilityCliCommand(): 'orcb' | 'orcb-dev' {
  return resolveOrcbCliCommandName(process.env)
}

export function resolvePackagedWindowsCompatibilityCommand(): 'orca' | 'orca-ide' | undefined {
  if (process.env.ORCA_WINDOWS_PACKAGED_CLI_LAUNCHER !== '1') {
    return undefined
  }
  const command = process.env.ORCA_CLI_COMMAND
  if (command === 'orca' || command === 'orca-ide') {
    return command
  }
  if (command === ORCB_CLI_COMMAND_NAME || command === ORCB_DEV_CLI_COMMAND_NAME) {
    // Why: old runtimes reject the new command enum. They receive this legacy
    // value while current ORCB runtimes use compatibilityOrcbWindowsCommand.
    return 'orca'
  }
  throw new RuntimeClientError(
    'invalid_argument',
    'The packaged ORCB launcher did not provide a valid resume command. No question was created.'
  )
}

export function resolvePackagedOrcbWindowsCompatibilityCommand(): 'orcb' | undefined {
  if (process.env.ORCA_WINDOWS_PACKAGED_CLI_LAUNCHER !== '1') {
    return undefined
  }
  if (process.env.ORCA_CLI_COMMAND === ORCB_CLI_COMMAND_NAME) {
    return ORCB_CLI_COMMAND_NAME
  }
  throw new RuntimeClientError(
    'invalid_argument',
    'The packaged ORCB launcher did not provide a valid resume command. No question was created.'
  )
}

export async function flushOrchestrationStdout(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write('', (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

export function isDevCliInvocation(): boolean {
  return isOrcbDevCliInvocation(process.env)
}
