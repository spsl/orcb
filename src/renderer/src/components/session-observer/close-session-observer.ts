import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { activateAndRevealWorkspace } from '@/lib/worktree-activation'
import {
  REQUEST_CLOSE_TERMINAL_PANE_EVENT,
  type RequestCloseTerminalPaneDetail
} from '@/constants/terminal'
import { useAppStore } from '@/store'
import type { SessionObserverCloseArgs } from '../../../../shared/session-observer'
import { parsePaneKey } from '../../../../shared/stable-pane-id'

/** Routes an observer close request through the live main-renderer terminal controller. */
export function closeSessionObserverSession(args: SessionObserverCloseArgs): boolean {
  if (!args.tabId || !args.ptyId) {
    return false
  }
  const targetTabs = useAppStore.getState().tabsByWorktree[args.worktreeId] ?? []
  if (!targetTabs.some((tab) => tab.id === args.tabId)) {
    return false
  }
  const parsedPane = parsePaneKey(args.paneKey)
  if (!parsedPane || parsedPane.tabId !== args.tabId) {
    return false
  }
  const activated = activateAndRevealWorkspace(args.worktreeId)
  if (activated === false) {
    return false
  }
  activateTabAndFocusPane(args.tabId, parsedPane.leafId, { flashFocusedPane: true })
  const detail: RequestCloseTerminalPaneDetail = {
    tabId: args.tabId,
    leafId: parsedPane.leafId,
    expectedPtyId: args.ptyId
  }
  const dispatchCloseRequest = (remainingFrames: number): void => {
    if (detail.handled) {
      return
    }
    window.dispatchEvent(
      new CustomEvent(REQUEST_CLOSE_TERMINAL_PANE_EVENT, {
        detail
      })
    )
    if (!detail.handled && remainingFrames > 0) {
      requestAnimationFrame(() => dispatchCloseRequest(remainingFrames - 1))
    }
  }
  // The first frame lets the activated tab mount; a bounded retry covers the
  // passive mount effect without risking duplicate closes after one succeeds.
  requestAnimationFrame(() => dispatchCloseRequest(2))
  return true
}
