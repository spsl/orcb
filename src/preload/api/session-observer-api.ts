import type {
  SessionObserverManualStatusOverride,
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
  onSnapshot: (callback: (snapshot: SessionObserverSnapshot) => void) => () => void
}
