import { useEffect } from 'react'
import { revealSessionObserverSession } from './reveal-session-observer'

/** Keeps the independent observer window's jump action connected to the main renderer store. */
export function useSessionObserverRevealBridge(): void {
  useEffect(
    () => window.api.sessionObserver.onReveal((args) => revealSessionObserverSession(args)),
    []
  )
}
