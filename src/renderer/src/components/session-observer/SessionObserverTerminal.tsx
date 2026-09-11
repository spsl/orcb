import { Terminal } from 'lucide-react'
import type { SessionObserverSessionView } from '../../../../shared/session-observer'
import { AgentTerminalPreview } from '@/components/dashboard-popout/AgentTerminalPreview'
import { cn } from '@/lib/utils'

export function SessionObserverTerminal({
  session,
  className,
  showHeader = true
}: {
  session: SessionObserverSessionView
  className?: string
  showHeader?: boolean
}): React.JSX.Element {
  const ptyId = session.ptyId
  return (
    <section className={cn('flex min-h-0 flex-col bg-background', className)}>
      {showHeader ? (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Terminal className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <h2 className="truncate text-sm font-semibold">终端</h2>
          </div>
          {ptyId ? (
            <span className="shrink-0 text-xs text-muted-foreground">已连接，可直接输入</span>
          ) : null}
        </div>
      ) : null}
      {ptyId ? (
        <div className="min-h-0 flex-1">
          <AgentTerminalPreview ptyId={ptyId} fillHeight className="min-h-0" />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          {session.terminalState === 'unknown'
            ? '当前无法确认该会话的终端连接。'
            : '该会话当前没有可附着的终端。'}
        </div>
      )}
    </section>
  )
}
