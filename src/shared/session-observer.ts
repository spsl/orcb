export type {
  SessionObserverAnalysisConfig,
  SessionObserverAnalyzerAgent,
  SessionObserverThinkingLevel
} from './session-observer-analysis'

export const SESSION_OBSERVER_ANALYSIS_STATUSES = [
  'in_progress',
  'waiting_for_user',
  'blocked',
  'completed',
  'unclear'
] as const

export type SessionObserverAnalysisStatus = (typeof SESSION_OBSERVER_ANALYSIS_STATUSES)[number]

export function isSessionObserverAnalysisStatus(
  value: unknown
): value is SessionObserverAnalysisStatus {
  return (
    typeof value === 'string' &&
    SESSION_OBSERVER_ANALYSIS_STATUSES.includes(value as SessionObserverAnalysisStatus)
  )
}

/** A user-owned board override; it never changes Orca's lifecycle state or the analysis record. */
export type SessionObserverManualStatusOverride = SessionObserverAnalysisStatus | null

/** Terminal liveness comes from the runtime inventory and can be unavailable during a transient outage. */
export type SessionObserverTerminalState = 'live' | 'closed' | 'unknown'

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
  /** Last runtime-confirmed filesystem path for display; absent on legacy records. */
  worktreePath?: string | null
  /** Last runtime-confirmed branch; null means confirmed detached/non-git. */
  gitBranch?: string | null
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
  manualStatusOverride: SessionObserverManualStatusOverride
  updatedAt: number
  completedAt: number | null
}

export type SessionObserverSessionView = SessionObserverSession & {
  ptyId: string | null
  live: boolean
  terminalState: SessionObserverTerminalState
  /** Latest model verdict, without an execution-state or user override applied. */
  modelStatus: SessionObserverAnalysisStatus
  /** The status the live board should present before applying the closed-terminal column. */
  effectiveStatus: SessionObserverAnalysisStatus
}

export type SessionObserverSnapshot = {
  generatedAt: number
  sessions: SessionObserverSessionView[]
}

/** Main-window routing target for returning from the observer to its source pane. */
export type SessionObserverRevealArgs = {
  worktreeId: string
  tabId: string | null
  paneKey: string
}

/** Main-window routing target for closing the source terminal pane. */
export type SessionObserverCloseArgs = Omit<SessionObserverRevealArgs, 'tabId'> & {
  tabId: string
  ptyId: string
}
