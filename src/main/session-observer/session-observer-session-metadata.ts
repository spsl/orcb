import type { SessionObserverSession } from '../../shared/session-observer'
import type { LiveTerminal } from './session-observer-runtime-terminals'
import { worktreePathFromId } from './session-observer-state-store'

export function applySessionObserverWorktreeIdentity(
  session: SessionObserverSession,
  nextWorktreeId: string | null
): void {
  if (nextWorktreeId === session.worktreeId) {
    return
  }
  session.worktreePath = worktreePathFromId(nextWorktreeId)
  session.gitBranch = null
  session.worktreeId = nextWorktreeId
}

/** Applies only metadata proven by a terminal matching both pane and worktree identity. */
export function applySessionObserverRuntimeMetadata(
  sessions: Iterable<SessionObserverSession>,
  terminalsByPaneKey: ReadonlyMap<string, LiveTerminal>
): boolean {
  let changed = false
  for (const session of sessions) {
    const terminal = terminalsByPaneKey.get(session.paneKey)
    if (!terminal || terminal.worktreeId !== session.worktreeId) {
      continue
    }
    if (terminal.worktreePath && terminal.worktreePath !== session.worktreePath) {
      session.worktreePath = terminal.worktreePath
      changed = true
    }
    if (terminal.gitBranch !== undefined && terminal.gitBranch !== session.gitBranch) {
      session.gitBranch = terminal.gitBranch
      changed = true
    }
  }
  return changed
}
