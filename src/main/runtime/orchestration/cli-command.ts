import type { ProjectExecutionRuntimeResolution } from '../../../shared/project-execution-runtime'
import { ORCB_CLI_COMMAND_NAME, ORCB_DEV_CLI_COMMAND_NAME } from '../../../shared/orcb-local-distribution'

export type OrchestrationCliCommand = typeof ORCB_CLI_COMMAND_NAME | typeof ORCB_DEV_CLI_COMMAND_NAME

export function resolveTerminalOrchestrationCliCommand(args: {
  connectionId: string | null
  isWsl: boolean | null | undefined
  worktreeId: string
  projectRuntime?: ProjectExecutionRuntimeResolution
  runtimeCliCommand?: OrchestrationCliCommand
}): OrchestrationCliCommand {
  if (args.connectionId) {
    return ORCB_CLI_COMMAND_NAME
  }
  if (args.runtimeCliCommand) {
    return args.runtimeCliCommand
  }
  if (args.isWsl !== null && args.isWsl !== undefined) {
    return ORCB_CLI_COMMAND_NAME
  }
  if (args.projectRuntime?.status === 'resolved' && args.projectRuntime.runtime.kind === 'wsl') {
    return ORCB_CLI_COMMAND_NAME
  }

  void args.worktreeId
  return ORCB_CLI_COMMAND_NAME
}
