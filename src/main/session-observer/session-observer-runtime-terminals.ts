import { makePaneKey } from '../../shared/stable-pane-id'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'

export type SessionObserverRuntime = Pick<OrcaRuntimeService, 'listTerminals'>

type LiveTerminal = { ptyId: string; title: string | null }

/** Lists only terminal identities that can safely receive input through the runtime. */
export async function listLiveTerminals(
  runtime: SessionObserverRuntime
): Promise<Map<string, LiveTerminal>> {
  const terminalsByPaneKey = new Map<string, LiveTerminal>()
  try {
    const listed = await runtime.listTerminals()
    for (const terminal of listed.terminals) {
      if (!terminal.connected || terminal.orphaned || typeof terminal.ptyId !== 'string') {
        continue
      }
      try {
        terminalsByPaneKey.set(makePaneKey(terminal.tabId, terminal.leafId), {
          ptyId: terminal.ptyId,
          title: terminal.title
        })
      } catch {
        // Older remote hosts can report legacy leaf ids that have no safe pane-key mapping.
      }
    }
  } catch {
    // Keep history visible during a transient runtime outage without inventing liveness.
  }
  return terminalsByPaneKey
}
