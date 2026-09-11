import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { activateAndRevealWorkspace } from '@/lib/worktree-activation'
import type { SessionObserverRevealArgs } from '../../../../shared/session-observer'
import { parsePaneKey } from '../../../../shared/stable-pane-id'

/** Re-enters the main renderer so workspace and terminal state come from its live store. */
export function revealSessionObserverSession(args: SessionObserverRevealArgs): boolean {
  const activated = activateAndRevealWorkspace(args.worktreeId)
  if (activated === false) {
    return false
  }

  if (args.tabId) {
    const parsedPane = parsePaneKey(args.paneKey)
    const leafId = parsedPane?.tabId === args.tabId ? parsedPane.leafId : null
    activateTabAndFocusPane(args.tabId, leafId, { flashFocusedPane: true })
  }
  return true
}
