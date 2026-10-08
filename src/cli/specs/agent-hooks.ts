import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const AGENT_HOOK_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['agent', 'hooks', 'prepare-codex'],
    summary: "Prepare a WSL pane's Orca-managed Codex home before a shell launch",
    usage: 'orcb agent hooks prepare-codex',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['agent', 'hooks', 'status'],
    summary: 'Show whether Orca-managed agent status hooks are enabled',
    usage: 'orcb agent hooks status [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['orcb agent hooks status', 'orcb agent hooks status --json']
  },
  {
    path: ['agent', 'hooks', 'off'],
    summary: 'Disable Orca-managed agent status hooks and remove local hook entries',
    usage: 'orcb agent hooks off [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['orcb agent hooks off']
  },
  {
    path: ['agent', 'hooks', 'on'],
    summary: 'Enable Orca-managed agent status hooks',
    usage: 'orcb agent hooks on [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['orcb agent hooks on']
  }
]
