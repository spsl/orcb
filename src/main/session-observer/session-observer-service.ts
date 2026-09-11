import type { AgentHookServer, EnrichedAgentHookEventPayload } from '../agent-hooks/server'
import type {
  SessionObserverSession,
  SessionObserverSessionView,
  SessionObserverSnapshot
} from '../../shared/session-observer'
import {
  CodexSessionObserverAnalyzer,
  type SessionObserverAnalyzer
} from './session-observer-analyzer'
import {
  boundedText,
  copySession,
  describeAnalysisError,
  lifecycleState,
  MAX_TURNS_PER_SESSION,
  sessionFromEvent,
  stableTextHash,
  type SessionObserverStateStore
} from './session-observer-state-store'
import {
  listLiveTerminals,
  type SessionObserverRuntime
} from './session-observer-runtime-terminals'

const MAX_SESSIONS = 200
const PERSIST_DEBOUNCE_MS = 300
const MAX_CONCURRENT_ANALYSES = 2

type SessionObserverHookServer = Pick<
  AgentHookServer,
  'getStatusSnapshot' | 'subscribeEnrichedStatus'
>

type SessionObserverServiceOptions = {
  runtime: SessionObserverRuntime
  hookServer: SessionObserverHookServer
  storage: SessionObserverStateStore
  analyzer?: SessionObserverAnalyzer
}

/** A read-only projection of hook events that does not alter Orca's agent-status store. */
export class SessionObserverService {
  private readonly sessions = new Map<string, SessionObserverSession>()
  private readonly listeners = new Set<() => void>()
  private readonly queuedSessionIds: string[] = []
  private readonly queuedSessionIdSet = new Set<string>()
  private readonly analyzer: SessionObserverAnalyzer
  private unsubscribeHookEvents: (() => void) | null = null
  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private runningAnalyses = 0
  private started = false

  constructor(private readonly options: SessionObserverServiceOptions) {
    this.analyzer = options.analyzer ?? new CodexSessionObserverAnalyzer()
  }

  start(): void {
    if (this.started) {
      return
    }
    this.started = true
    this.unsubscribeHookEvents = this.options.hookServer.subscribeEnrichedStatus((event) => {
      this.observe(event)
    })
    for (const status of this.options.hookServer.getStatusSnapshot()) {
      this.observe({
        paneKey: status.paneKey,
        tabId: status.tabId,
        worktreeId: status.worktreeId,
        connectionId: status.connectionId ?? null,
        receivedAt: status.receivedAt,
        evidenceObservedAt: status.evidenceObservedAt,
        stateStartedAt: status.stateStartedAt,
        payload: status
      })
    }
    void this.restore()
  }

  stop(): void {
    this.unsubscribeHookEvents?.()
    this.unsubscribeHookEvents = null
    this.started = false
    if (this.persistTimer) {
      clearTimeout(this.persistTimer)
      this.persistTimer = null
    }
    void this.persist()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  observe(event: EnrichedAgentHookEventPayload): void {
    if (event.providerSessionOnly || !event.payload.agentType) {
      return
    }
    const existing = this.sessions.get(event.paneKey)
    const session = existing ?? sessionFromEvent(event)
    const nextPrompt = boundedText(event.payload.prompt)
    const previousPrompt = session.prompt
    if (nextPrompt && nextPrompt !== previousPrompt) {
      session.prompt = nextPrompt
      if (event.hasExplicitPrompt === true || previousPrompt === null) {
        session.analysis = null
        session.analysisError = null
        session.analysisState = 'awaiting_output'
      }
    }
    session.tabId = event.tabId ?? session.tabId
    session.worktreeId = event.worktreeId ?? session.worktreeId
    session.agentType = event.payload.agentType
    session.model = event.payload.model ?? session.model
    session.lifecycleState = lifecycleState(event.payload.state)
    session.updatedAt = event.evidenceObservedAt ?? event.receivedAt

    const output = boundedText(event.payload.lastAssistantMessage)
    let analysisSessionId: string | null = null
    if (
      event.payload.state === 'done' &&
      event.payload.sessionBoundary !== true &&
      event.payload.lastAssistantMessageIsToolOutput !== true &&
      output
    ) {
      const completedAt =
        event.payload.turnCompletedAt ?? event.evidenceObservedAt ?? event.receivedAt
      const turnId = `${event.stateStartedAt}:${stableTextHash(output)}`
      if (!session.turns.some((turn) => turn.id === turnId)) {
        session.turns.push({
          id: turnId,
          userInput: session.prompt,
          agentOutput: output,
          completedAt,
          contextIncomplete: session.prompt === null
        })
        session.turns = session.turns.slice(-MAX_TURNS_PER_SESSION)
        session.latestOutput = output
        session.completedAt = completedAt
        session.analysis = null
        session.analysisError = null
        session.analysisState = 'queued'
        analysisSessionId = session.id
      }
    } else if (event.payload.state === 'done' && session.turns.length === 0) {
      session.analysisState = 'awaiting_output'
    }

    this.sessions.set(session.id, session)
    if (analysisSessionId) {
      this.enqueueAnalysis(analysisSessionId)
    }
    this.schedulePersist()
    this.emitChange()
  }

  async snapshot(): Promise<SessionObserverSnapshot> {
    const terminalByPaneKey = await listLiveTerminals(this.options.runtime)
    const sessions: SessionObserverSessionView[] = Array.from(this.sessions.values(), (session) => {
      const terminal = terminalByPaneKey.get(session.paneKey)
      return {
        ...copySession(session),
        ...(terminal?.title ? { title: terminal.title } : {}),
        ptyId: terminal?.ptyId ?? null,
        live: terminal !== undefined
      }
    }).sort((left, right) => right.updatedAt - left.updatedAt)
    return { generatedAt: Date.now(), sessions }
  }

  reanalyze(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session || session.turns.length === 0 || session.analysisState === 'running') {
      return false
    }
    session.analysis = null
    session.analysisError = null
    session.analysisState = 'queued'
    this.enqueueAnalysis(session.id)
    this.schedulePersist()
    this.emitChange()
    return true
  }

  async waitForIdleForTests(): Promise<void> {
    while (this.runningAnalyses > 0 || this.queuedSessionIds.length > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  }

  private async restore(): Promise<void> {
    const restored = await this.options.storage.load()
    let changed = false
    for (const session of restored) {
      if (!this.sessions.has(session.id)) {
        this.sessions.set(session.id, session)
        changed = true
      }
    }
    if (changed) {
      this.emitChange()
    }
  }

  private enqueueAnalysis(sessionId: string): void {
    if (this.queuedSessionIdSet.has(sessionId)) {
      return
    }
    this.queuedSessionIdSet.add(sessionId)
    this.queuedSessionIds.push(sessionId)
    void this.drainAnalysisQueue()
  }

  private async drainAnalysisQueue(): Promise<void> {
    while (this.runningAnalyses < MAX_CONCURRENT_ANALYSES && this.queuedSessionIds.length > 0) {
      const sessionId = this.queuedSessionIds.shift()
      if (!sessionId) {
        return
      }
      this.queuedSessionIdSet.delete(sessionId)
      const session = this.sessions.get(sessionId)
      if (!session || session.turns.length === 0) {
        continue
      }
      this.runningAnalyses += 1
      void this.runAnalysis(sessionId).finally(() => {
        this.runningAnalyses -= 1
        void this.drainAnalysisQueue()
      })
    }
  }

  private async runAnalysis(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return
    }
    const targetTurnId = session.turns.at(-1)?.id
    if (!targetTurnId) {
      return
    }
    session.analysisState = 'running'
    session.analysisError = null
    this.emitChange()
    try {
      const result = await this.analyzer.analyze(copySession(session))
      const current = this.sessions.get(sessionId)
      if (!current || current.turns.at(-1)?.id !== targetTurnId) {
        return
      }
      current.analysis = result
      current.analysisState = 'ready'
      current.analysisError = null
    } catch (error) {
      const current = this.sessions.get(sessionId)
      if (!current || current.turns.at(-1)?.id !== targetTurnId) {
        return
      }
      current.analysisState = 'failed'
      current.analysisError = describeAnalysisError(error)
    }
    this.schedulePersist()
    this.emitChange()
  }

  private emitChange(): void {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch (error) {
        console.error('[session-observer] listener failed', error)
      }
    }
  }

  private schedulePersist(): void {
    if (this.persistTimer) {
      return
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      void this.persist()
    }, PERSIST_DEBOUNCE_MS)
    this.persistTimer.unref?.()
  }

  private async persist(): Promise<void> {
    try {
      const sessions = Array.from(this.sessions.values())
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, MAX_SESSIONS)
      await this.options.storage.save(sessions)
    } catch (error) {
      console.warn('[session-observer] could not persist session history', error)
    }
  }
}
