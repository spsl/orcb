import { Circle, Loader2 } from 'lucide-react'
import type { SessionObserverSessionView } from '../../../../shared/session-observer'
import { formatShortTimeAgo } from '@/lib/short-time-ago'
import { cn } from '@/lib/utils'
import {
  analysisStateLabel,
  analysisStatusLabel,
  SESSION_OBSERVER_COLUMNS,
  sessionGitBranchLabel,
  sessionColumn,
  sessionTitle,
  sessionWorkspaceLabel,
  type SessionObserverColumnId
} from './session-observer-presentation'

const COLUMN_TONE: Record<SessionObserverColumnId, string> = {
  unclear: 'text-muted-foreground',
  waiting_for_user: 'text-agent-question',
  in_progress: 'text-ai-action-accent',
  completed: 'text-status-success',
  closed: 'text-muted-foreground'
}

function SessionCard({
  session,
  selected,
  onSelect
}: {
  session: SessionObserverSessionView
  selected: boolean
  onSelect: (sessionId: string) => void
}): React.JSX.Element {
  const column = sessionColumn(session)
  const summary = session.analysis?.summary ?? analysisStateLabel(session.analysisState)
  const nextStep = session.analysis?.nextSteps[0] ?? null
  const workspaceLabel = sessionWorkspaceLabel(session)
  const branchLabel = sessionGitBranchLabel(session)
  const terminalStateLabel =
    session.terminalState === 'closed'
      ? '终端已结束'
      : session.terminalState === 'unknown'
        ? '终端状态未知'
        : analysisStateLabel(session.analysisState)
  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-lg border bg-card p-3 text-left shadow-xs transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        selected ? 'border-ring bg-accent/60' : 'border-border'
      )}
      onClick={() => onSelect(session.id)}
      aria-pressed={selected}
      aria-label={`${sessionTitle(session)}，${column === 'closed' ? '已关闭' : analysisStatusLabel(session.effectiveStatus)}`}
    >
      <div className="flex items-start gap-2">
        <Circle className={cn('mt-0.5 size-3 shrink-0', COLUMN_TONE[column])} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{sessionTitle(session)}</span>
        {session.analysisState === 'running' ? (
          <Loader2
            className="size-3 shrink-0 animate-spin text-muted-foreground"
            aria-label="正在分析"
          />
        ) : null}
      </div>
      <p
        className="mt-2 truncate font-mono text-[11px] text-muted-foreground"
        title={workspaceLabel}
      >
        工作区：{workspaceLabel}
      </p>
      {branchLabel ? (
        <p
          className="mt-1 truncate font-mono text-[11px] text-muted-foreground"
          title={branchLabel}
        >
          分支：{branchLabel}
        </p>
      ) : null}
      <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-muted-foreground">{summary}</p>
      {nextStep ? (
        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
          下一步：{nextStep}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
        {session.manualStatusOverride ? (
          <span className="rounded-full bg-muted px-1.5 py-0.5">手工覆盖</span>
        ) : null}
        {session.effectiveStatus === 'blocked' && session.live ? (
          <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-destructive">
            阻塞
          </span>
        ) : null}
        {session.analysis?.needsUserAttention ? (
          <span className="rounded-full bg-agent-question/10 px-1.5 py-0.5 text-agent-question">
            需要人工介入
          </span>
        ) : null}
        <span>{terminalStateLabel}</span>
        <span className="ml-auto shrink-0">{formatShortTimeAgo(session.updatedAt)}</span>
      </div>
    </button>
  )
}

export function SessionObserverBoard({
  sessions,
  selectedSessionId,
  onSelect
}: {
  sessions: readonly SessionObserverSessionView[]
  selectedSessionId: string | null
  onSelect: (sessionId: string) => void
}): React.JSX.Element {
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="会话状态看板">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold">会话看板</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">根据当前执行状态与最新分析结论归类</p>
        </div>
        <span className="text-xs text-muted-foreground">{sessions.length} 个会话</span>
      </div>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-3">
        <div className="grid h-full min-w-[1150px] grid-cols-5 gap-3">
          {SESSION_OBSERVER_COLUMNS.map((column) => {
            const columnSessions = sessions.filter(
              (session) => sessionColumn(session) === column.id
            )
            return (
              <section
                key={column.id}
                className="flex min-h-0 flex-col rounded-lg border border-border bg-muted/30"
                aria-label={column.label}
              >
                <div className="border-b border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-medium">{column.label}</h3>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {columnSessions.length}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                    {column.hint}
                  </p>
                </div>
                <div className="scrollbar-sleek min-h-0 space-y-2 overflow-y-auto p-2">
                  {columnSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      selected={session.id === selectedSessionId}
                      onSelect={onSelect}
                    />
                  ))}
                  {columnSessions.length === 0 ? (
                    <p className="px-1 py-3 text-center text-xs text-muted-foreground">暂无会话</p>
                  ) : null}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </section>
  )
}
