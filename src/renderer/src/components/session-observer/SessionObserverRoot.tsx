import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { SessionObserverSnapshot } from '../../../../shared/session-observer'
import { Button } from '@/components/ui/button'
import { useAppMenuPaste } from '@/hooks/useAppMenuPaste'
import { useAppMenuSelectionActions } from '@/hooks/useAppMenuSelectionActions'
import { SessionObserverBoard } from './SessionObserverBoard'
import { SessionObserverDetail } from './SessionObserverDetail'
import { SessionObserverTerminal } from './SessionObserverTerminal'

const EMPTY_SNAPSHOT: SessionObserverSnapshot = { generatedAt: 0, sessions: [] }

export function SessionObserverRoot(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<SessionObserverSnapshot>(EMPTY_SNAPSHOT)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [reanalysisPendingId, setReanalysisPendingId] = useState<string | null>(null)
  useAppMenuPaste()
  useAppMenuSelectionActions()

  const refreshSnapshot = useCallback((): void => {
    void window.api.sessionObserver.requestSnapshot()
  }, [])

  useEffect(() => {
    const unsubscribe = window.api.sessionObserver.onSnapshot(setSnapshot)
    refreshSnapshot()
    return unsubscribe
  }, [refreshSnapshot])

  useEffect(() => {
    setSelectedSessionId((current) => {
      if (current && snapshot.sessions.some((session) => session.id === current)) {
        return current
      }
      return snapshot.sessions[0]?.id ?? null
    })
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
      <main className="grid min-h-0 flex-1 grid-rows-[minmax(220px,0.9fr)_minmax(320px,1.1fr)]">
        <SessionObserverBoard
          sessions={snapshot.sessions}
          selectedSessionId={selectedSessionId}
          onSelect={setSelectedSessionId}
        />
        <div className="grid min-h-0 grid-cols-2">
          <SessionObserverDetail
            session={selectedSession}
            reanalysisPending={reanalysisPendingId === selectedSession?.id}
            onReanalyze={reanalyze}
          />
          <SessionObserverTerminal session={selectedSession} />
        </div>
      </main>
    </div>
  )
}
