import { getCommitMessageAgentSpec } from './commit-message-agent-spec'
import {
  CLAUDE_SESSION_OPTION_CATALOG,
  CODEX_SESSION_OPTION_CATALOG
} from './agent-session-option-catalog-claude-codex'
import type { CatalogModel } from './agent-session-option-catalog-types'

/** Agents with a non-interactive, text-input analysis adapter. */
export const SESSION_OBSERVER_ANALYZER_AGENTS = ['codex', 'claude', 'pi'] as const

export type SessionObserverAnalyzerAgent = (typeof SESSION_OBSERVER_ANALYZER_AGENTS)[number]

export type SessionObserverThinkingLevel =
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max'
  | 'ultra'
  | 'on'
  | 'off'

export type SessionObserverAnalysisConfig = {
  agent: SessionObserverAnalyzerAgent
  /** CLI model id. Dynamic provider ids are allowed for forward compatibility. */
  model: string
  /** null delegates the effort choice to the selected CLI/model. */
  thinkingLevel: SessionObserverThinkingLevel | null
}

export type SessionObserverAnalyzerAgentOption = {
  id: SessionObserverAnalyzerAgent
  label: string
}

export type SessionObserverAnalyzerModelOption = {
  id: string
  label: string
}

export type SessionObserverThinkingLevelOption = {
  id: SessionObserverThinkingLevel
  label: string
}

/** The historical observer behavior, made explicit so a new profile is predictable. */
export const DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG: SessionObserverAnalysisConfig = {
  agent: 'codex',
  model: 'gpt-5.6-luna',
  thinkingLevel: 'max'
}

const THINKING_LEVEL_ORDER: readonly SessionObserverThinkingLevel[] = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'ultra'
]

const AGENT_OPTIONS: readonly SessionObserverAnalyzerAgentOption[] = [
  { id: 'codex', label: 'Codex' },
  { id: 'claude', label: 'Claude' },
  { id: 'pi', label: 'Pi' }
]

// Keep a small, useful seed in the UI. The model field remains editable because
// provider accounts and CLI releases can expose models that Orca cannot know ahead of time.
type ObserverModelDefinition = SessionObserverAnalyzerModelOption & {
  thinkingLevels?: readonly SessionObserverThinkingLevelOption[]
}

function catalogModelDefinitions(models: readonly CatalogModel[]): ObserverModelDefinition[] {
  return models.map((model) => ({
    id: model.id,
    label: model.label,
    thinkingLevels: catalogThinkingLevels(model)
  }))
}

function catalogThinkingLevels(model: CatalogModel): SessionObserverThinkingLevelOption[] {
  const effort = model.options.find((option) => option.id === 'effort')
  if (!effort || effort.kind.type !== 'select') {
    return []
  }
  return effort.kind.choices.flatMap((choice) => {
    return isKnownThinkingLevel(choice.value) ? [{ id: choice.value, label: choice.label }] : []
  })
}

function modelDefinitions(agent: SessionObserverAnalyzerAgent): ObserverModelDefinition[] {
  if (agent === 'codex') {
    return catalogModelDefinitions(CODEX_SESSION_OPTION_CATALOG.models)
  }
  if (agent === 'claude') {
    return catalogModelDefinitions(CLAUDE_SESSION_OPTION_CATALOG.models)
  }
  const models = getCommitMessageAgentSpec('pi')?.models ?? []
  return models.map((model) => ({
    id: model.id,
    label: model.label,
    thinkingLevels: (model.thinkingLevels ?? []).flatMap((level) =>
      isKnownThinkingLevel(level.id) ? [{ id: level.id, label: level.label }] : []
    )
  }))
}

const MODEL_OPTIONS: Record<SessionObserverAnalyzerAgent, readonly ObserverModelDefinition[]> = {
  codex: modelDefinitions('codex'),
  claude: modelDefinitions('claude'),
  pi: modelDefinitions('pi')
}

const THINKING_OPTIONS: Record<
  SessionObserverAnalyzerAgent,
  readonly SessionObserverThinkingLevelOption[]
> = {
  codex: [
    { id: 'minimal', label: 'Minimal' },
    { id: 'low', label: 'Low' },
    { id: 'medium', label: 'Medium' },
    { id: 'high', label: 'High' },
    { id: 'xhigh', label: 'Extra high' },
    { id: 'max', label: 'Max' },
    { id: 'ultra', label: 'Ultra' }
  ],
  claude: [
    { id: 'low', label: 'Low' },
    { id: 'medium', label: 'Medium' },
    { id: 'high', label: 'High' },
    { id: 'xhigh', label: 'Extra high' },
    { id: 'max', label: 'Max' }
  ],
  pi: [
    { id: 'low', label: 'Low' },
    { id: 'medium', label: 'Medium' },
    { id: 'high', label: 'High' },
    { id: 'xhigh', label: 'Extra high' }
  ]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isThinkingLevel(value: unknown): value is SessionObserverThinkingLevel {
  return (
    typeof value === 'string' &&
    (THINKING_OPTIONS.codex.some((option) => option.id === value) ||
      THINKING_OPTIONS.claude.some((option) => option.id === value) ||
      THINKING_OPTIONS.pi.some((option) => option.id === value))
  )
}

function isKnownThinkingLevel(value: unknown): value is SessionObserverThinkingLevel {
  return (
    typeof value === 'string' &&
    THINKING_LEVEL_ORDER.includes(value as SessionObserverThinkingLevel)
  )
}

export function isSessionObserverAnalyzerAgent(
  value: unknown
): value is SessionObserverAnalyzerAgent {
  return (
    typeof value === 'string' &&
    (SESSION_OBSERVER_ANALYZER_AGENTS as readonly string[]).includes(value)
  )
}

export function getSessionObserverAnalyzerAgentOptions(): readonly SessionObserverAnalyzerAgentOption[] {
  return AGENT_OPTIONS
}

export function getSessionObserverAnalyzerModelOptions(
  agent: SessionObserverAnalyzerAgent
): readonly SessionObserverAnalyzerModelOption[] {
  return MODEL_OPTIONS[agent].map(({ id, label }) => ({ id, label }))
}

function defaultModelForAgent(agent: SessionObserverAnalyzerAgent): string {
  if (agent === 'claude' && MODEL_OPTIONS.claude.some((model) => model.id === 'sonnet')) {
    return 'sonnet'
  }
  return MODEL_OPTIONS[agent][0]?.id ?? DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG.model
}

function defaultThinkingForModel(
  agent: SessionObserverAnalyzerAgent,
  model: string
): SessionObserverThinkingLevel | null {
  const options = getSessionObserverThinkingLevelOptions(agent, model)
  if (options.length === 0) {
    return null
  }
  if (agent === 'codex' && model === DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG.model) {
    return 'max'
  }
  return options.find((option) => option.id === 'low')?.id ?? options[0].id
}

export function getSessionObserverThinkingLevelOptions(
  agent: SessionObserverAnalyzerAgent,
  model: string
): readonly SessionObserverThinkingLevelOption[] {
  const options = THINKING_OPTIONS[agent]
  const knownModel = MODEL_OPTIONS[agent].find((option) => option.id === model.trim())
  if (knownModel) {
    return knownModel.thinkingLevels ?? []
  }
  if (agent === 'claude' && model.trim().toLowerCase() === 'haiku') {
    return []
  }
  return options
}

export function getDefaultSessionObserverAnalysisConfig(
  agent: SessionObserverAnalyzerAgent
): SessionObserverAnalysisConfig {
  const model =
    agent === DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG.agent
      ? DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG.model
      : defaultModelForAgent(agent)
  return {
    agent,
    model,
    thinkingLevel: defaultThinkingForModel(agent, model)
  }
}

/** Normalizes persisted or IPC-provided values and always returns a fresh snapshot. */
export function normalizeSessionObserverAnalysisConfig(
  value: unknown,
  fallback: SessionObserverAnalysisConfig | undefined = DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG
): SessionObserverAnalysisConfig {
  const fallbackValue = fallback ?? DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG
  const fallbackAgent = isSessionObserverAnalyzerAgent(fallbackValue.agent)
    ? fallbackValue.agent
    : DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG.agent
  const record = isRecord(value) ? value : undefined
  const requestedAgent = isSessionObserverAnalyzerAgent(record?.agent)
    ? record.agent
    : fallbackAgent
  const fallbackModel =
    typeof fallbackValue.model === 'string' && fallbackValue.model.trim().length > 0
      ? fallbackValue.model.trim().slice(0, 512)
      : getDefaultSessionObserverAnalysisConfig(fallbackAgent).model
  const requestedModel =
    typeof record?.model === 'string' && record.model.trim().length > 0
      ? record.model.trim().slice(0, 512)
      : requestedAgent === fallbackAgent
        ? fallbackModel
        : getDefaultSessionObserverAnalysisConfig(requestedAgent).model
  const model = requestedModel || getDefaultSessionObserverAnalysisConfig(requestedAgent).model
  const options = getSessionObserverThinkingLevelOptions(requestedAgent, model)
  const requestedThinking =
    record && Object.hasOwn(record, 'thinkingLevel')
      ? record.thinkingLevel
      : requestedAgent === fallbackAgent && model === fallbackModel
        ? fallbackValue.thinkingLevel
        : defaultThinkingForModel(requestedAgent, model)
  const thinkingLevel =
    requestedThinking === null
      ? null
      : isThinkingLevel(requestedThinking) &&
          options.some((option) => option.id === requestedThinking)
        ? requestedThinking
        : defaultThinkingForModel(requestedAgent, model)

  return { agent: requestedAgent, model, thinkingLevel }
}
