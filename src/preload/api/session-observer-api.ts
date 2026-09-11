import type {
  SessionObserverManualStatusOverride,
  SessionObserverRevealArgs,
  SessionObserverCloseArgs,
  SessionObserverSnapshot
} from '../../shared/session-observer'

export type SessionObserverApi = {
  open: () => Promise<void>
  requestSnapshot: () => Promise<void>
  reanalyze: (sessionId: string) => Promise<boolean>
  updateManualStatus: (
    sessionId: string,
    manualStatusOverride: SessionObserverManualStatusOverride
  ) => Promise<boolean>
  reveal: (args: SessionObserverRevealArgs) => Promise<boolean>
  close: (args: SessionObserverCloseArgs) => Promise<boolean>
  onReveal: (callback: (args: SessionObserverRevealArgs) => void) => () => void
  onClose: (callback: (args: SessionObserverCloseArgs) => void) => () => void
  onSnapshot: (callback: (snapshot: SessionObserverSnapshot) => void) => () => void
}
