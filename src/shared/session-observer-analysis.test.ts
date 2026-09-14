import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG,
  getDefaultSessionObserverAnalysisConfig,
  getSessionObserverAnalyzerModelOptions,
  getSessionObserverThinkingLevelOptions,
  normalizeSessionObserverAnalysisConfig
} from './session-observer-analysis'

describe('session observer analysis configuration', () => {
  it('keeps the historical Codex configuration as the default', () => {
    expect(DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG).toEqual({
      agent: 'codex',
      model: 'gpt-5.6-luna',
      thinkingLevel: 'max'
    })
    const copy = normalizeSessionObserverAnalysisConfig(undefined)
    expect(copy).toEqual(DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG)
    expect(copy).not.toBe(DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG)
  })

  it('normalizes malformed persisted values and bounds model ids', () => {
    const normalized = normalizeSessionObserverAnalysisConfig({
      agent: 'not-an-agent',
      model: `  ${'m'.repeat(600)}  `,
      thinkingLevel: 'not-a-level'
    })
    expect(normalized.agent).toBe('codex')
    expect(normalized.model).toHaveLength(512)
    expect(normalized.thinkingLevel).toBe('low')
  })

  it('selects a safe default for each supported adapter', () => {
    expect(getDefaultSessionObserverAnalysisConfig('claude')).toMatchObject({
      agent: 'claude',
      model: 'sonnet',
      thinkingLevel: 'low'
    })
    expect(getDefaultSessionObserverAnalysisConfig('pi')).toMatchObject({
      agent: 'pi',
      model: 'github-copilot/gpt-5.4-mini',
      thinkingLevel: 'low'
    })
  })

  it('uses the selected model capabilities for thinking levels', () => {
    expect(
      getSessionObserverThinkingLevelOptions('codex', 'gpt-5.6-luna').map(({ id }) => id)
    ).toEqual(['minimal', 'low', 'medium', 'high', 'xhigh', 'max'])
    expect(getSessionObserverThinkingLevelOptions('claude', 'haiku')).toEqual([])
    expect(
      getSessionObserverThinkingLevelOptions('pi', 'github-copilot/gpt-5.4-mini').map(
        ({ id }) => id
      )
    ).toEqual(['low', 'medium', 'high', 'xhigh'])
  })

  it('preserves a valid explicit null effort and accepts dynamic model ids', () => {
    expect(
      normalizeSessionObserverAnalysisConfig({
        agent: 'claude',
        model: 'account-specific-model',
        thinkingLevel: null
      })
    ).toEqual({ agent: 'claude', model: 'account-specific-model', thinkingLevel: null })
    expect(getSessionObserverAnalyzerModelOptions('codex')).toEqual(
      expect.arrayContaining([
        { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
        { id: 'gpt-5.5', label: 'GPT-5.5' }
      ])
    )
  })
})
