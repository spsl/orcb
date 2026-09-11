import { useEffect } from 'react'
import { closeSessionObserverSession } from './close-session-observer'

/** Keeps the standalone observer close action connected to the main renderer terminal controllers. */
export function useSessionObserverCloseBridge(): void {
  useEffect(
    () => window.api.sessionObserver.onClose((args) => closeSessionObserverSession(args)),
    []
  )
}
