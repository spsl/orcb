import { describe, expect, it, vi } from 'vitest'
import type { EnrichedAgentHookEventPayload } from '../agent-hooks/server'
import type { SessionObserverAnalysis } from '../../shared/session-observer'
import { SessionObserverService } from './session-observer-service'
import type { SessionObserverStateStore } from './session-observer-state-store'
import type { SessionObserverAnalyzer } from './session-observer-analyzer'

const analysis: SessionObserverAnalysis = {
  summary: '已经完成终端接入。',
  goal: '接入终端。',
  status: 'completed',
  progress: ['复用了 PTY 预览。'],
  completed: ['终端已接入。'],
  nextSteps: [],
  blockers: [],
  needsUserAttention: false,
  confidence: 0.9
}

function completedEvent(): EnrichedAgentHookEventPayload {
  return {
    paneKey: 'pane-1',
    receivedAt: 1_000,
    stateStartedAt: 900,
    payload: {
      agentType: 'codex',
      state: 'done',
      prompt: '接入终端',
      lastAssistantMessage: '终端已经可以直接输入。'
    }
  } as EnrichedAgentHookEventPayload
}

describe('SessionObserverService', () => {
  it('stores a completed turn before its queued analysis can run', async () => {
    const analyze = vi.fn(async () => analysis)
    const analyzer: SessionObserverAnalyzer = { analyze }
    const storage: SessionObserverStateStore = {
      load: vi.fn(async () => []),
      save: vi.fn(async () => undefined)
    }
    const service = new SessionObserverService({
      runtime: {
        listTerminals: vi.fn(async () => ({ terminals: [] }))
      } as never,
      hookServer: {
        getStatusSnapshot: () => [],
        subscribeEnrichedStatus: () => () => undefined
      } as never,
      storage,
      analyzer
    })

    service.observe(completedEvent())
    await service.waitForIdleForTests()

    expect(analyze).toHaveBeenCalledTimes(1)
    await expect(service.snapshot()).resolves.toEqual(
      expect.objectContaining({
        sessions: [
          expect.objectContaining({
            id: 'pane-1',
            analysisState: 'ready',
            analysis,
            latestOutput: '终端已经可以直接输入。'
          })
        ]
      })
    )
  })

  it('maps a live runtime terminal through its stable tab and leaf identities', async () => {
    const paneKey = 'tab-1:11111111-1111-4111-8111-111111111111'
    const service = new SessionObserverService({
      runtime: {
        listTerminals: vi.fn(async () => ({
          terminals: [
            {
              tabId: 'tab-1',
              leafId: '11111111-1111-4111-8111-111111111111',
              ptyId: 'pty-1',
              connected: true,
              orphaned: false,
              title: 'Codex'
            }
          ]
        }))
      } as never,
      hookServer: {
        getStatusSnapshot: () => [],
        subscribeEnrichedStatus: () => () => undefined
      } as never,
      storage: {
        load: vi.fn(async () => []),
        save: vi.fn(async () => undefined)
      },
      analyzer: { analyze: vi.fn(async () => analysis) }
    })

    service.observe({
      ...completedEvent(),
      paneKey,
      payload: {
        ...completedEvent().payload,
        state: 'working'
      }
    })

    await expect(service.snapshot()).resolves.toMatchObject({
      sessions: [
        {
          id: paneKey,
          ptyId: 'pty-1',
          live: true,
          title: 'Codex'
        }
      ]
    })
  })

  it('prioritizes live execution, then a user override, over an older analysis', async () => {
    const paneKey = 'tab-1:11111111-1111-4111-8111-111111111111'
    const service = new SessionObserverService({
      runtime: {
        listTerminals: vi.fn(async () => ({
          terminals: [
            {
              tabId: 'tab-1',
              leafId: '11111111-1111-4111-8111-111111111111',
              ptyId: 'pty-1',
              connected: true,
              orphaned: false,
              title: 'Codex'
            }
          ]
        }))
      } as never,
      hookServer: {
        getStatusSnapshot: () => [],
        subscribeEnrichedStatus: () => () => undefined
      } as never,
      storage: {
        load: vi.fn(async () => []),
        save: vi.fn(async () => undefined)
      },
      analyzer: { analyze: vi.fn(async () => analysis) }
    })

    service.observe({ ...completedEvent(), paneKey })
    await service.waitForIdleForTests()
    service.observe({
      ...completedEvent(),
      paneKey,
      payload: { ...completedEvent().payload, state: 'working' }
    })

    await expect(service.snapshot()).resolves.toMatchObject({
      sessions: [{ modelStatus: 'completed', effectiveStatus: 'in_progress', live: true }]
    })
    await expect(service.updateManualStatus(paneKey, 'blocked')).resolves.toBe(true)
    await expect(service.snapshot()).resolves.toMatchObject({
      sessions: [{ manualStatusOverride: 'blocked', effectiveStatus: 'blocked' }]
    })
  })

  it('keeps terminal state unknown when the runtime inventory is unavailable', async () => {
    const service = new SessionObserverService({
      runtime: {
        listTerminals: vi.fn(async () => {
          throw new Error('runtime unavailable')
        })
      } as never,
      hookServer: {
        getStatusSnapshot: () => [],
        subscribeEnrichedStatus: () => () => undefined
      } as never,
      storage: {
        load: vi.fn(async () => []),
        save: vi.fn(async () => undefined)
      },
      analyzer: { analyze: vi.fn(async () => analysis) }
    })

    service.observe(completedEvent())
    await service.waitForIdleForTests()

    await expect(service.snapshot()).resolves.toMatchObject({
      sessions: [{ live: false, terminalState: 'unknown' }]
    })
  })
})
