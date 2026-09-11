export const SESSION_OBSERVER_ANALYSIS_STATUSES = [
  'in_progress',
  'waiting_for_user',
  'blocked',
  'completed',
  'unclear'
] as const

export type SessionObserverAnalysisStatus = (typeof SESSION_OBSERVER_ANALYSIS_STATUSES)[number]

export type SessionObserverAnalysis = {
  summary: string
  goal: string
  status: SessionObserverAnalysisStatus
  progress: string[]
  completed: string[]
  nextSteps: string[]
  blockers: string[]
  needsUserAttention: boolean
  confidence: number
}

export type SessionObserverAnalysisState =
  | 'awaiting_output'
  | 'queued'
  | 'running'
  | 'ready'
  | 'failed'

export type SessionObserverTurn = {
  id: string
  userInput: string | null
  agentOutput: string
  completedAt: number
  contextIncomplete: boolean
}

export type SessionObserverSession = {
  id: string
  paneKey: string
  tabId: string | null
  worktreeId: string | null
  agentType: string
  model: string | null
  lifecycleState: 'working' | 'waiting' | 'blocked' | 'done' | 'unknown'
  prompt: string | null
  latestOutput: string | null
  title: string | null
  turns: SessionObserverTurn[]
  analysisState: SessionObserverAnalysisState
  analysis: SessionObserverAnalysis | null
  analysisError: string | null
  updatedAt: number
  completedAt: number | null
}

export type SessionObserverSessionView = SessionObserverSession & {
  ptyId: string | null
  live: boolean
}

export type SessionObserverSnapshot = {
  generatedAt: number
  sessions: SessionObserverSessionView[]
}
