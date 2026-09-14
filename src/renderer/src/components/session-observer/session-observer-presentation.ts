import type {
  SessionObserverAnalysisState,
  SessionObserverAnalysisStatus,
  SessionObserverSessionView
} from '../../../../shared/session-observer'
import { normalizeRuntimePathSeparators } from '../../../../shared/cross-platform-path'
import { splitWorktreeIdForFilesystem } from '../../../../shared/worktree/id'
import { branchName } from '../../lib/git-utils'

export const SESSION_OBSERVER_COLUMNS = [
  { id: 'unclear', label: '不明确', hint: '尚无足够可靠的当前结论' },
  { id: 'waiting_for_user', label: '需要处理', hint: '等待确认、输入、选择或审批' },
  { id: 'in_progress', label: '进行中', hint: 'Agent 正在推进任务' },
  { id: 'completed', label: '已完成', hint: '当前分析明确表示任务完成' },
  { id: 'closed', label: '已关闭', hint: 'Orca 中的终端已经结束' }
] as const

export const SESSION_OBSERVER_STATUS_OPTIONS: readonly {
  status: SessionObserverAnalysisStatus
  label: string
}[] = [
  { status: 'waiting_for_user', label: '需要处理' },
  { status: 'blocked', label: '阻塞' },
  { status: 'in_progress', label: '进行中' },
  { status: 'completed', label: '已完成' },
  { status: 'unclear', label: '不明确' }
]

export type SessionObserverColumnId = (typeof SESSION_OBSERVER_COLUMNS)[number]['id']

export function sessionColumn(session: SessionObserverSessionView): SessionObserverColumnId {
  // A terminal that has ended is history regardless of its last model verdict.
  if (session.terminalState === 'closed') {
    return 'closed'
  }
  return columnForStatus(session.effectiveStatus)
}

function columnForStatus(status: SessionObserverAnalysisStatus): SessionObserverColumnId {
  if (status === 'waiting_for_user' || status === 'blocked') {
    return 'waiting_for_user'
  }
  return status
}

export function sessionTitle(session: SessionObserverSessionView): string {
  return firstLine(session.title) ?? firstLine(session.prompt) ?? `${session.agentType} 会话`
}

export function sessionWorkspaceLabel(session: SessionObserverSessionView): string {
  const pathValue =
    session.worktreePath?.trim() ||
    splitWorktreeIdForFilesystem(session.worktreeId ?? '')?.worktreePath.trim()
  if (!pathValue) {
    return '未知'
  }
  const parts = normalizeRuntimePathSeparators(pathValue.normalize('NFC')).split('/').filter(Boolean)
  return parts.length >= 2 ? parts.slice(-2).join('/') : (parts[0] ?? '未知')
}

export function sessionGitBranchLabel(session: SessionObserverSessionView): string | null {
  const branch = session.gitBranch?.trim()
  return branch ? branchName(branch) : null
}

export function firstLine(value: string | null, maxLength = 96): string | null {
  if (!value) {
    return null
  }
  const line = value.replace(/\s+/g, ' ').trim()
  if (!line) {
    return null
  }
  return line.length > maxLength ? `${line.slice(0, maxLength - 1)}…` : line
}

export function analysisStateLabel(state: SessionObserverAnalysisState): string {
  switch (state) {
    case 'awaiting_output':
      return '等待有效回复'
    case 'queued':
      return '等待分析'
    case 'running':
      return '正在分析'
    case 'ready':
      return '分析已就绪'
    case 'failed':
      return '分析失败'
  }
}

export function analysisStatusLabel(status: SessionObserverAnalysisStatus): string {
  return (
    SESSION_OBSERVER_STATUS_OPTIONS.find((option) => option.status === status)?.label ?? '不明确'
  )
}
