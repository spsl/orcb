import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type {
  SessionObserverManualStatusOverride,
  SessionObserverSessionView,
  SessionObserverSnapshot
} from '../../../../shared/session-observer'
import { Button } from '@/components/ui/button'
import { useAppMenuPaste } from '@/hooks/useAppMenuPaste'
import { useAppMenuSelectionActions } from '@/hooks/useAppMenuSelectionActions'
import { SessionObserverBoard } from './SessionObserverBoard'
import { SessionObserverDetailDialog } from './SessionObserverDetailDialog'
import { SessionObserverAnalyzerSettings } from './SessionObserverAnalyzerSettings'

const EMPTY_SNAPSHOT: SessionObserverSnapshot = { generatedAt: 0, sessions: [] }
const TERMINAL_STATE_REFRESH_MS = 3_000

export function SessionObserverRoot(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<SessionObserverSnapshot>(EMPTY_SNAPSHOT)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [reanalysisPendingId, setReanalysisPendingId] = useState<string | null>(null)
  const [statusUpdatePendingId, setStatusUpdatePendingId] = useState<string | null>(null)
  const [closePendingId, setClosePendingId] = useState<string | null>(null)
  useAppMenuPaste()
  useAppMenuSelectionActions()

  const refreshSnapshot = useCallback((): void => {
    void window.api.sessionObserver.requestSnapshot()
  }, [])

  useEffect(() => {
    const unsubscribe = window.api.sessionObserver.onSnapshot(setSnapshot)
    refreshSnapshot()
    const terminalStateRefresh = window.setInterval(refreshSnapshot, TERMINAL_STATE_REFRESH_MS)
    return () => {
      unsubscribe()
      window.clearInterval(terminalStateRefresh)
    }
  }, [refreshSnapshot])

  useEffect(() => {
    setSelectedSessionId((current) =>
      current && snapshot.sessions.some((session) => session.id === current) ? current : null
    )
  }, [snapshot.sessions])

  const selectedSession = useMemo(
    () => snapshot.sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, snapshot.sessions]
  )
  const liveTerminalCount = snapshot.sessions.filter((session) => session.ptyId !== null).length

  const reanalyze = (sessionId: string): void => {
    setReanalysisPendingId(sessionId)
    void window.api.sessionObserver
      .reanalyze(sessionId)
      .catch(() => false)
      .finally(() => {
        setReanalysisPendingId((current) => (current === sessionId ? null : current))
      })
  }

  const updateManualStatus = (
    sessionId: string,
    manualStatusOverride: SessionObserverManualStatusOverride
  ): void => {
    setStatusUpdatePendingId(sessionId)
    void window.api.sessionObserver
      .updateManualStatus(sessionId, manualStatusOverride)
      .catch(() => false)
      .finally(() => {
        setStatusUpdatePendingId((current) => (current === sessionId ? null : current))
      })
  }

  const revealSession = (session: SessionObserverSessionView): void => {
    if (!session.worktreeId) {
      return
    }
    void window.api.sessionObserver
      .reveal({
        worktreeId: session.worktreeId,
        tabId: session.tabId,
        paneKey: session.paneKey
      })
      .then((revealed) => {
        if (revealed) {
          setSelectedSessionId(null)
        }
      })
      .catch(() => undefined)
  }

  const closeSession = (session: SessionObserverSessionView): void => {
    if (
      !session.worktreeId ||
      !session.tabId ||
      session.terminalState !== 'live' ||
      !session.ptyId
    ) {
      return
    }
    // Close the observer dialog before handing the terminal close to the main renderer.
    setSelectedSessionId(null)
    setClosePendingId(session.id)
    void window.api.sessionObserver
      .close({
        worktreeId: session.worktreeId,
        tabId: session.tabId,
        paneKey: session.paneKey,
        ptyId: session.ptyId
      })
      .catch(() => false)
      .finally(() => {
        setClosePendingId((current) => (current === session.id ? null : current))
        refreshSnapshot()
      })
  }

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3">
        <div>
          <h1 className="text-base font-semibold">会话分析</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">独立会话投影与原生终端接入</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {liveTerminalCount} 个可附着终端
          </span>
          <Button type="button" variant="outline" size="sm" onClick={refreshSnapshot}>
            <RefreshCw />
            刷新
          </Button>
        </div>
      </header>
      <SessionObserverAnalyzerSettings />
      <main className="flex min-h-0 flex-1">
        <SessionObserverBoard
          sessions={snapshot.sessions}
          selectedSessionId={selectedSessionId}
          onSelect={setSelectedSessionId}
        />
      </main>
      <SessionObserverDetailDialog
        session={selectedSession}
        reanalysisPending={reanalysisPendingId === selectedSession?.id}
        statusUpdatePending={statusUpdatePendingId === selectedSession?.id}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSessionId(null)
          }
        }}
        onReanalyze={reanalyze}
        onManualStatusChange={updateManualStatus}
        onReveal={revealSession}
        onCloseTerminal={closeSession}
        closePending={closePendingId === selectedSession?.id}
      />
    </div>
  )
}
