import { ORCB_CLI_COMMAND_NAME } from './orcb-local-distribution'

export function getOrcaCliCommandNameForPlatform(platform: NodeJS.Platform): string {
  void platform
  return ORCB_CLI_COMMAND_NAME
}
