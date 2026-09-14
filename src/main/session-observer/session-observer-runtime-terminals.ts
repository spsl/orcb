import { makePaneKey } from '../../shared/stable-pane-id'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'

export type SessionObserverRuntime = Pick<OrcaRuntimeService, 'listTerminals'>

export type LiveTerminal = {
  ptyId: string
  worktreeId: string
  title: string | null
  worktreePath?: string
  /** null means the runtime explicitly reported no branch; undefined means unavailable. */
  gitBranch?: string | null
}

export type LiveTerminalInventory = {
  terminalsByPaneKey: Map<string, LiveTerminal>
  runtimeAvailable: boolean
}

/** Lists only terminal identities that can safely receive input through the runtime. */
export async function listLiveTerminals(
  runtime: SessionObserverRuntime
): Promise<LiveTerminalInventory> {
  const terminalsByPaneKey = new Map<string, LiveTerminal>()
  try {
    const listed = await runtime.listTerminals()
    for (const terminal of listed.terminals) {
      if (!terminal.connected || terminal.orphaned || typeof terminal.ptyId !== 'string') {
        continue
      }
      try {
        const terminalRecord = terminal as typeof terminal & {
          worktreePath?: unknown
          branch?: unknown
        }
        terminalsByPaneKey.set(makePaneKey(terminal.tabId, terminal.leafId), {
          ptyId: terminal.ptyId,
          worktreeId: terminal.worktreeId,
          title: terminal.title,
          ...(typeof terminalRecord.worktreePath === 'string' && terminalRecord.worktreePath.trim()
            ? { worktreePath: terminalRecord.worktreePath.trim() }
            : {}),
          ...(Object.hasOwn(terminalRecord, 'branch')
            ? {
                gitBranch:
                  typeof terminalRecord.branch === 'string' && terminalRecord.branch.trim()
                    ? terminalRecord.branch.trim()
                    : null
              }
            : {})
        })
      } catch {
        // Older remote hosts can report legacy leaf ids that have no safe pane-key mapping.
      }
    }
    return { terminalsByPaneKey, runtimeAvailable: true }
  } catch {
    // A failed inventory cannot prove that every previously visible terminal ended.
    return { terminalsByPaneKey, runtimeAvailable: false }
  }
}
