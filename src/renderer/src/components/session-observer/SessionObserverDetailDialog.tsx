import { Loader2, RefreshCw, SquareArrowOutUpRight, Trash2, XIcon } from 'lucide-react'
import type {
  SessionObserverAnalysisStatus,
  SessionObserverManualStatusOverride,
  SessionObserverSessionView
} from '../../../../shared/session-observer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { SessionObserverDetail } from './SessionObserverDetail'
import { SessionObserverTerminal } from './SessionObserverTerminal'
import {
  analysisStateLabel,
  analysisStatusLabel,
  SESSION_OBSERVER_STATUS_OPTIONS,
  sessionTitle
} from './session-observer-presentation'

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
}

function Metadata({ session }: { session: SessionObserverSessionView }): React.JSX.Element {
  const values = [
    ['Agent / 模型', `${session.agentType}${session.model ? ` / ${session.model}` : ''}`],
    ['工作区', session.worktreeId ?? '未知'],
    ['会话标识', session.paneKey],
    ['最近更新', formatTime(session.updatedAt)],
    [
      '终端',
      session.terminalState === 'live'
        ? '可附着'
        : session.terminalState === 'closed'
          ? '已结束'
          : '状态未知'
    ],
    ['分析状态', analysisStateLabel(session.analysisState)]
  ]
  return (
    <dl className="grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-1">
      {values.map(([label, value]) => (
        <div key={label} className="grid min-w-0 grid-cols-[76px_minmax(0,1fr)] gap-2">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="truncate text-foreground" title={value}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function StatusControl({
  session,
  pending,
  onChange
}: {
  session: SessionObserverSessionView
  pending: boolean
  onChange: (manualStatusOverride: SessionObserverManualStatusOverride) => void
}): React.JSX.Element {
  const disabled = pending || session.terminalState !== 'live'
  const selectValue = session.manualStatusOverride ?? session.effectiveStatus
  const handleChange = (value: string): void => {
    const next = value as SessionObserverAnalysisStatus
    if (!session.manualStatusOverride && next === session.effectiveStatus) {
      return
    }
    onChange(next)
  }
  return (
    <section className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium">看板状态</h3>
          <Badge variant="secondary">{analysisStatusLabel(session.effectiveStatus)}</Badge>
          {session.manualStatusOverride ? <Badge variant="outline">手工覆盖</Badge> : null}
        </div>
        {session.manualStatusOverride ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            恢复自动状态
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectValue} disabled={disabled} onValueChange={handleChange}>
          <SelectTrigger size="sm" aria-label="调整看板状态">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SESSION_OBSERVER_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.status} value={option.status}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          {session.terminalState === 'live'
            ? '手工状态会覆盖当前分析，直到恢复自动状态。'
            : session.terminalState === 'closed'
              ? '终端已结束，状态保持为历史记录。'
              : '当前无法确认终端连接，状态暂不允许修改。'}
        </p>
      </div>
    </section>
  )
}

/** Observer-style session workspace with analysis and the attached terminal side by side. */
export function SessionObserverDetailDialog({
  session,
  reanalysisPending,
  statusUpdatePending,
  onOpenChange,
  onReanalyze,
  onManualStatusChange,
  onReveal,
  onCloseTerminal,
  closePending
}: {
  session: SessionObserverSessionView | null
  reanalysisPending: boolean
  statusUpdatePending: boolean
  onOpenChange: (open: boolean) => void
  onReanalyze: (sessionId: string) => void
  onManualStatusChange: (
    sessionId: string,
    manualStatusOverride: SessionObserverManualStatusOverride
  ) => void
  onReveal: (session: SessionObserverSessionView) => void
  onCloseTerminal: (session: SessionObserverSessionView) => void
  closePending: boolean
}): React.JSX.Element {
  const canReanalyze = Boolean(
    session && session.turns.length > 0 && session.analysisState !== 'running'
  )
  return (
    <Dialog open={session !== null} onOpenChange={onOpenChange}>
      {session ? (
        <DialogContent
          aria-describedby={undefined}
          className="flex h-[calc(100vh-2rem)] max-h-[860px] w-[calc(100vw-2rem)] max-w-[1420px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1420px]"
          showCloseButton={false}
          onEscapeKeyDown={(event) => {
            if (event.target instanceof HTMLElement && event.target.closest('.xterm')) {
              event.preventDefault()
            }
          }}
          onOpenAutoFocus={(event) => {
            if (session.ptyId) {
              event.preventDefault()
            }
          }}
        >
          <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-sm">{sessionTitle(session)}</DialogTitle>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {session.agentType}
                {session.model ? ` · ${session.model}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={!canReanalyze || reanalysisPending}
                onClick={() => onReanalyze(session.id)}
                aria-label="重新分析"
                title="重新分析"
              >
                <RefreshCw className={cn(reanalysisPending && 'animate-spin')} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => onOpenChange(false)}
                aria-label="关闭"
                title="关闭"
              >
                <XIcon />
              </Button>
            </div>
          </header>
          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(320px,2fr)] lg:grid-cols-[minmax(300px,1fr)_minmax(0,2fr)] lg:grid-rows-1">
            <aside className="scrollbar-sleek min-h-0 overflow-y-auto border-b border-border p-4 lg:border-r lg:border-b-0">
              <div className="space-y-5">
                <StatusControl
                  session={session}
                  pending={statusUpdatePending}
                  onChange={(manualStatusOverride) =>
                    onManualStatusChange(session.id, manualStatusOverride)
                  }
                />
                <Metadata session={session} />
                <SessionObserverDetail session={session} />
              </div>
            </aside>
            <SessionObserverTerminal session={session} className="h-full min-h-0 min-w-0" />
          </div>
          {session.worktreeId ? (
            <footer className="flex shrink-0 items-center gap-1.5 border-t border-border px-4 py-2">
              {session.terminalState === 'live' && session.ptyId ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="xs"
                  disabled={closePending}
                  onClick={() => onCloseTerminal(session)}
                  aria-label="关闭终端"
                  title="关闭终端"
                >
                  {closePending ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  关闭终端
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="ml-auto"
                onClick={() => onReveal(session)}
                aria-label="打开工作树"
                title="打开工作树"
              >
                <SquareArrowOutUpRight className="size-3" />
                打开工作树
              </Button>
            </footer>
          ) : null}
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
