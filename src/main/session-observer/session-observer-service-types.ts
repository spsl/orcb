import type { AgentHookServer } from '../agent-hooks/server'
import type {
  SessionObserverAnalysisConfig,
  SessionObserverAnalyzerAgent
} from '../../shared/session-observer-analysis'
import type { SessionObserverAnalyzer } from './session-observer-analyzer'
import type { SessionObserverRuntime } from './session-observer-runtime-terminals'
import type { SessionObserverStateStore } from './session-observer-state-store'

export type ObserverHookServer = Pick<
  AgentHookServer,
  'getStatusSnapshot' | 'subscribeEnrichedStatus'
>

export type SessionObserverServiceOptions = {
  runtime: SessionObserverRuntime
  hookServer: ObserverHookServer
  storage: SessionObserverStateStore
  analyzer?: SessionObserverAnalyzer
  getAnalyzerConfig?: () => SessionObserverAnalysisConfig | undefined
  getAnalyzerCommand?: (agent: SessionObserverAnalyzerAgent) => string | undefined
}
