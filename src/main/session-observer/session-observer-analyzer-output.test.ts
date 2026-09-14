import { describe, expect, it } from 'vitest'
import {
  parseSessionObserverAnalysis,
  parseSessionObserverAnalysisOutput
} from './session-observer-analyzer-output'
import type { SessionObserverAnalysis } from '../../shared/session-observer'

const analysis: SessionObserverAnalysis = {
  summary: '已经完成需求。',
  goal: '完成需求',
  status: 'completed',
  progress: ['已实现'],
  completed: ['已验证'],
  nextSteps: [],
  blockers: [],
  needsUserAttention: false,
  confidence: 0.95
}

describe('session observer analyzer output', () => {
  it('validates a direct structured result', () => {
    expect(parseSessionObserverAnalysisOutput(JSON.stringify(analysis))).toEqual(analysis)
  })

  it('unwraps Claude-style JSON envelopes and nested result text', () => {
    expect(
      parseSessionObserverAnalysisOutput(
        JSON.stringify({
          type: 'result',
          result: JSON.stringify(analysis)
        })
      )
    ).toEqual(analysis)
  })

  it('finds fenced JSON after logs and ANSI styling', () => {
    const output = [
      '\u001b[2mstarting analysis\u001b[0m',
      '```json',
      JSON.stringify(analysis),
      '```'
    ].join('\n')
    expect(parseSessionObserverAnalysisOutput(output)).toEqual(analysis)
  })

  it('rejects malformed or schema-invalid output', () => {
    expect(() => parseSessionObserverAnalysisOutput('分析失败，没有 JSON')).toThrow(/JSON/)
    expect(() => parseSessionObserverAnalysis({ ...analysis, confidence: 2 })).toThrow(/置信度/)
    expect(() =>
      parseSessionObserverAnalysis({ ...analysis, progress: ['x'.repeat(4_001)] })
    ).toThrow(/progress/)
  })
})
