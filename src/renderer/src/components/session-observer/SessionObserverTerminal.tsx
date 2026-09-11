import { Terminal } from 'lucide-react'
import type { SessionObserverSessionView } from '../../../../shared/session-observer'
import { AgentTerminalPreview } from '@/components/dashboard-popout/AgentTerminalPreview'

export function SessionObserverTerminal({
  session
}: {
  session: SessionObserverSessionView | null
}): React.JSX.Element {
  const ptyId = session?.ptyId ?? null
  return (
    <section className="flex min-h-0 flex-col bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Terminal className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <h2 className="truncate text-sm font-semibold">终端</h2>
        </div>
        {ptyId ? (
          <span className="shrink-0 text-xs text-muted-foreground">已连接，可直接输入</span>
        ) : null}
      </div>
      {ptyId ? (
        <div className="min-h-0 flex-1">
          <AgentTerminalPreview ptyId={ptyId} fillHeight className="min-h-0" />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          {session
            ? '该会话当前没有可附着的终端。'
            : '选择一个会话后，在这里查看并直接操作它的终端。'}
        </div>
      )}
    </section>
  )
}
