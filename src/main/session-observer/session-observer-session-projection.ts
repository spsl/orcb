import type {
  SessionObserverSession,
  SessionObserverSessionView,
  SessionObserverTerminalState
} from '../../shared/session-observer'
import { copySession } from './session-observer-state-store'
import type { LiveTerminalInventory } from './session-observer-runtime-terminals'

export function projectSessionObserverView(
  session: SessionObserverSession,
  terminalInventory: LiveTerminalInventory
): SessionObserverSessionView {
  const terminal = terminalInventory.terminalsByPaneKey.get(session.paneKey)
  const terminalState: SessionObserverTerminalState = terminal
    ? 'live'
    : terminalInventory.runtimeAvailable
      ? 'closed'
      : 'unknown'
  const modelStatus = session.analysis?.status ?? 'unclear'
  // A working agent outranks an older analysis so a new prompt cannot look completed.
  const effectiveStatus =
    session.manualStatusOverride ??
    (terminalState !== 'closed' && session.lifecycleState === 'working'
      ? 'in_progress'
      : modelStatus)

  return {
    ...copySession(session),
    ...(terminal?.title ? { title: terminal.title } : {}),
    ptyId: terminal?.ptyId ?? null,
    live: terminal !== undefined,
    terminalState,
    modelStatus,
    effectiveStatus
  }
}
