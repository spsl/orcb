import { Loader2, RefreshCw } from 'lucide-react'
import type { SessionObserverSessionView } from '../../../../shared/session-observer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  analysisStateLabel,
  analysisStatusLabel,
  sessionTitle
} from './session-observer-presentation'

function ListSection({
  title,
  items,
  emptyText
}: {
  title: string
  items: string[]
  emptyText: string
}): React.JSX.Element {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-medium text-foreground">{title}</h3>
      {items.length > 0 ? (
        <ul className="space-y-1 text-sm leading-5 text-muted-foreground">
          {items.map((item) => (
            <li key={`${title}-${item}`} className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      )}
    </section>
  )
}

function AnalysisState({ session }: { session: SessionObserverSessionView }): React.JSX.Element {
  if (session.analysisState === 'failed') {
    return <p className="text-sm text-destructive">{session.analysisError ?? '分析失败'}</p>
  }
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {session.analysisState === 'queued' || session.analysisState === 'running' ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : null}
      <span>{analysisStateLabel(session.analysisState)}</span>
    </div>
  )
}

export function SessionObserverDetail({
  session,
  reanalysisPending,
  onReanalyze
}: {
  session: SessionObserverSessionView | null
  reanalysisPending: boolean
  onReanalyze: (sessionId: string) => void
}): React.JSX.Element {
  if (!session) {
    return (
      <section className="flex min-h-0 flex-col border-r border-border">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">分析详情</h2>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          选择一个会话后查看分析结果和最近一轮输出。
        </div>
      </section>
    )
  }

  const analysis = session.analysis
  const canReanalyze = session.turns.length > 0 && session.analysisState !== 'running'
  return (
    <section className="flex min-h-0 flex-col border-r border-border">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{sessionTitle(session)}</h2>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {session.agentType}
            {session.model ? ` · ${session.model}` : ''}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={!canReanalyze || reanalysisPending}
          onClick={() => onReanalyze(session.id)}
        >
          <RefreshCw className={cn(reanalysisPending && 'animate-spin')} />
          重新分析
        </Button>
      </div>
      <div className="scrollbar-sleek min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {analysis ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={analysis.needsUserAttention ? 'destructive' : 'secondary'}>
                {analysisStatusLabel(analysis.status)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                置信度 {Math.round(analysis.confidence * 100)}%
              </span>
            </div>
            <section className="space-y-1.5">
              <h3 className="text-xs font-medium">当前判断</h3>
              <p className="text-sm leading-5 text-muted-foreground">{analysis.summary}</p>
            </section>
            <section className="space-y-1.5">
              <h3 className="text-xs font-medium">目标</h3>
              <p className="text-sm leading-5 text-muted-foreground">{analysis.goal}</p>
            </section>
            <ListSection title="进展" items={analysis.progress} emptyText="暂无明确进展" />
            <ListSection title="已完成" items={analysis.completed} emptyText="尚无完成证据" />
            <ListSection title="下一步" items={analysis.nextSteps} emptyText="暂无下一步建议" />
            <ListSection title="阻塞项" items={analysis.blockers} emptyText="未发现阻塞项" />
          </>
        ) : (
          <AnalysisState session={session} />
        )}
        {session.latestOutput ? (
          <details className="rounded-md border border-border bg-muted/30 p-3">
            <summary className="cursor-pointer text-xs font-medium text-foreground">
              最近一轮回复
            </summary>
            <pre className="scrollbar-sleek mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-muted-foreground">
              {session.latestOutput}
            </pre>
          </details>
        ) : null}
      </div>
    </section>
  )
}
