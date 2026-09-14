import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { splitWorktreeIdForFilesystem } from '../../shared/worktree/id'
import type { EnrichedAgentHookEventPayload } from '../agent-hooks/server'
import type {
  SessionObserverAnalysis,
  SessionObserverAnalysisStatus,
  SessionObserverSession,
  SessionObserverTurn
} from '../../shared/session-observer'
import { SESSION_OBSERVER_ANALYSIS_STATUSES } from '../../shared/session-observer'

const PERSISTED_STATE_VERSION = 1
const MAX_TEXT_LENGTH = 16_000
export const MAX_TURNS_PER_SESSION = 12

type PersistedSessionObserverState = {
  version: number
  sessions: SessionObserverSession[]
}

export type SessionObserverStateStore = {
  load(): Promise<SessionObserverSession[]>
  save(sessions: readonly SessionObserverSession[]): Promise<void>
}

export function boundedText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized.slice(0, MAX_TEXT_LENGTH) : null
}

export function worktreePathFromId(worktreeId: string | null | undefined): string | null {
  if (!worktreeId) {
    return null
  }
  return boundedText(splitWorktreeIdForFilesystem(worktreeId)?.worktreePath)
}

export function lifecycleState(value: unknown): SessionObserverSession['lifecycleState'] {
  return value === 'working' || value === 'waiting' || value === 'blocked' || value === 'done'
    ? value
    : 'unknown'
}

export function stableTextHash(value: string): string {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return (hash >>> 0).toString(36)
}

function copyAnalysis(analysis: SessionObserverAnalysis | null): SessionObserverAnalysis | null {
  return analysis
    ? {
        ...analysis,
        progress: [...analysis.progress],
        completed: [...analysis.completed],
        nextSteps: [...analysis.nextSteps],
        blockers: [...analysis.blockers]
      }
    : null
}

export function copySession(session: SessionObserverSession): SessionObserverSession {
  return {
    ...session,
    turns: session.turns.map((turn) => ({ ...turn })),
    analysis: copyAnalysis(session.analysis)
  }
}

function hydrateTurn(value: unknown): SessionObserverTurn | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const id = boundedText(record.id)
  const agentOutput = boundedText(record.agentOutput)
  if (
    !id ||
    !agentOutput ||
    typeof record.completedAt !== 'number' ||
    !Number.isFinite(record.completedAt)
  ) {
    return null
  }
  return {
    id,
    userInput: boundedText(record.userInput),
    agentOutput,
    completedAt: record.completedAt,
    contextIncomplete: record.contextIncomplete === true
  }
}

function hydrateAnalysis(value: unknown): SessionObserverAnalysis | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const status = record.status
  const list = (key: string): string[] | null => {
    const items = record[key]
    if (!Array.isArray(items) || items.some((item) => boundedText(item) === null)) {
      return null
    }
    return items.map((item) => boundedText(item)!)
  }
  const summary = boundedText(record.summary)
  const goal = boundedText(record.goal)
  const progress = list('progress')
  const completed = list('completed')
  const nextSteps = list('nextSteps')
  const blockers = list('blockers')
  if (
    !summary ||
    !goal ||
    !progress ||
    !completed ||
    !nextSteps ||
    !blockers ||
    (status !== 'in_progress' &&
      status !== 'waiting_for_user' &&
      status !== 'blocked' &&
      status !== 'completed' &&
      status !== 'unclear') ||
    typeof record.needsUserAttention !== 'boolean' ||
    typeof record.confidence !== 'number' ||
    !Number.isFinite(record.confidence)
  ) {
    return null
  }
  return {
    summary,
    goal,
    status,
    progress,
    completed,
    nextSteps,
    blockers,
    needsUserAttention: record.needsUserAttention,
    confidence: Math.min(1, Math.max(0, record.confidence))
  }
}

function manualStatusOverride(value: unknown): SessionObserverAnalysisStatus | null {
  return typeof value === 'string' &&
    SESSION_OBSERVER_ANALYSIS_STATUSES.includes(value as SessionObserverAnalysisStatus)
    ? (value as SessionObserverAnalysisStatus)
    : null
}

export function hydrateSession(value: unknown): SessionObserverSession | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const id = boundedText(record.id)
  const paneKey = boundedText(record.paneKey)
  const agentType = boundedText(record.agentType)
  const turns = Array.isArray(record.turns)
    ? record.turns.map(hydrateTurn).filter((turn): turn is SessionObserverTurn => turn !== null)
    : []
  const analysisState = record.analysisState
  if (
    !id ||
    !paneKey ||
    !agentType ||
    (analysisState !== 'awaiting_output' &&
      analysisState !== 'queued' &&
      analysisState !== 'running' &&
      analysisState !== 'ready' &&
      analysisState !== 'failed') ||
    typeof record.updatedAt !== 'number' ||
    !Number.isFinite(record.updatedAt)
  ) {
    return null
  }
  return {
    id,
    paneKey,
    tabId: boundedText(record.tabId),
    worktreeId: boundedText(record.worktreeId),
    worktreePath:
      boundedText(record.worktreePath) ?? worktreePathFromId(record.worktreeId as string | null | undefined),
    gitBranch: boundedText(record.gitBranch),
    agentType,
    model: boundedText(record.model),
    lifecycleState: lifecycleState(record.lifecycleState),
    prompt: boundedText(record.prompt),
    latestOutput: boundedText(record.latestOutput),
    title: boundedText(record.title),
    turns: turns.slice(-MAX_TURNS_PER_SESSION),
    analysisState: analysisState === 'running' ? 'failed' : analysisState,
    analysis: hydrateAnalysis(record.analysis),
    analysisError:
      analysisState === 'running' ? '上次分析在应用关闭前中断' : boundedText(record.analysisError),
    manualStatusOverride: manualStatusOverride(record.manualStatusOverride),
    updatedAt: record.updatedAt,
    completedAt:
      typeof record.completedAt === 'number' && Number.isFinite(record.completedAt)
        ? record.completedAt
        : null
  }
}

export function sessionFromEvent(event: EnrichedAgentHookEventPayload): SessionObserverSession {
  const now = event.evidenceObservedAt ?? event.receivedAt
  return {
    id: event.paneKey,
    paneKey: event.paneKey,
    tabId: event.tabId ?? null,
    worktreeId: event.worktreeId ?? null,
    worktreePath: worktreePathFromId(event.worktreeId),
    gitBranch: null,
    agentType: event.payload.agentType ?? 'unknown',
    model: event.payload.model ?? null,
    lifecycleState: lifecycleState(event.payload.state),
    prompt: boundedText(event.payload.prompt),
    latestOutput: null,
    title: null,
    turns: [],
    analysisState: 'awaiting_output',
    analysis: null,
    analysisError: null,
    manualStatusOverride: null,
    updatedAt: now,
    completedAt: null
  }
}

export function describeAnalysisError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.trim().slice(0, 320) || '分析失败'
}

/** Stores only the observer's own bounded session history under Electron userData. */
export class JsonSessionObserverStateStore implements SessionObserverStateStore {
  constructor(private readonly path: string) {}

  async load(): Promise<SessionObserverSession[]> {
    try {
      const parsed = JSON.parse(await readFile(this.path, 'utf8')) as PersistedSessionObserverState
      if (parsed?.version !== PERSISTED_STATE_VERSION || !Array.isArray(parsed.sessions)) {
        return []
      }
      return parsed.sessions
        .map(hydrateSession)
        .filter((session): session is SessionObserverSession => session !== null)
    } catch {
      return []
    }
  }

  async save(sessions: readonly SessionObserverSession[]): Promise<void> {
    const directory = dirname(this.path)
    const temporaryPath = join(directory, `.session-observer-${process.pid}-${Date.now()}.json`)
    await mkdir(directory, { recursive: true, mode: 0o700 })
    await writeFile(
      temporaryPath,
      JSON.stringify({
        version: PERSISTED_STATE_VERSION,
        sessions: sessions.map(copySession)
      } satisfies PersistedSessionObserverState),
      { mode: 0o600 }
    )
    await rename(temporaryPath, this.path)
  }
}
