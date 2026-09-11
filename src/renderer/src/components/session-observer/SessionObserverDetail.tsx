import { Loader2 } from 'lucide-react'
import type { SessionObserverSessionView } from '../../../../shared/session-observer'
import { Badge } from '@/components/ui/badge'
import { analysisStateLabel, analysisStatusLabel } from './session-observer-presentation'

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

function formatTurnTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
}

/** Analysis and captured-turn content shared by the detail dialog. */
export function SessionObserverDetail({
  session
}: {
  session: SessionObserverSessionView
}): React.JSX.Element {
  const analysis = session.analysis
  return (
    <div className="space-y-5">
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
            <h3 className="text-xs font-medium">当前目标</h3>
            <p className="text-sm leading-5 text-muted-foreground">{analysis.goal}</p>
          </section>
          <ListSection title="进展" items={analysis.progress} emptyText="暂无明确进展" />
          <ListSection title="已完成" items={analysis.completed} emptyText="尚无完成证据" />
          <ListSection title="下一步" items={analysis.nextSteps} emptyText="暂无下一步建议" />
          <ListSection title="阻塞原因" items={analysis.blockers} emptyText="未发现阻塞项" />
        </>
      ) : (
        <AnalysisState session={session} />
      )}
      <details className="rounded-md border border-border bg-muted/30 p-3">
        <summary className="cursor-pointer text-xs font-medium text-foreground">
          会话记录（{session.turns.length}）
        </summary>
        <div className="mt-3 space-y-3">
          {session.turns.length > 0 ? (
            session.turns.toReversed().map((turn) => (
              <details
                key={turn.id}
                className="rounded border border-border/70 bg-background/50 p-2"
              >
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  {formatTurnTime(turn.completedAt)}
                  {turn.contextIncomplete ? ' · 上下文不完整' : ''}
                </summary>
                <div className="mt-3 space-y-2">
                  <section className="space-y-1">
                    <h4 className="text-xs font-medium">用户输入</h4>
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-muted-foreground">
                      {turn.userInput ?? '未采集到该轮输入'}
                    </pre>
                  </section>
                  <section className="space-y-1">
                    <h4 className="text-xs font-medium">Agent 回复</h4>
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-muted-foreground">
                      {turn.agentOutput}
                    </pre>
                  </section>
                </div>
              </details>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">看板尚未保存会话内容。</p>
          )}
        </div>
      </details>
    </div>
  )
}
