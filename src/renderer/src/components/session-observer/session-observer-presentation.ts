import type {
  SessionObserverAnalysisState,
  SessionObserverSessionView
} from '../../../../shared/session-observer'

export const SESSION_OBSERVER_COLUMNS = [
  { id: 'working', label: '执行中' },
  { id: 'waiting', label: '等待确认' },
  { id: 'blocked', label: '受阻' },
  { id: 'completed', label: '已完成' },
  { id: 'review', label: '待分析' }
] as const

export type SessionObserverColumnId = (typeof SESSION_OBSERVER_COLUMNS)[number]['id']

export function sessionColumn(session: SessionObserverSessionView): SessionObserverColumnId {
  const analysisStatus = session.analysis?.status
  if (analysisStatus === 'waiting_for_user') {
    return 'waiting'
  }
  if (analysisStatus === 'blocked') {
    return 'blocked'
  }
  if (analysisStatus === 'completed') {
    return 'completed'
  }
  if (analysisStatus === 'in_progress') {
    return 'working'
  }
  if (session.lifecycleState === 'waiting') {
    return 'waiting'
  }
  if (session.lifecycleState === 'blocked') {
    return 'blocked'
  }
  if (session.lifecycleState === 'done') {
    return 'completed'
  }
  if (session.lifecycleState === 'working') {
    return 'working'
  }
  return 'review'
}

export function sessionTitle(session: SessionObserverSessionView): string {
  return firstLine(session.title) ?? firstLine(session.prompt) ?? `${session.agentType} 会话`
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

export function analysisStatusLabel(
  status: NonNullable<SessionObserverSessionView['analysis']>['status']
): string {
  switch (status) {
    case 'in_progress':
      return '进行中'
    case 'waiting_for_user':
      return '等待确认'
    case 'blocked':
      return '受阻'
    case 'completed':
      return '已完成'
    case 'unclear':
      return '信息不足'
  }
}
