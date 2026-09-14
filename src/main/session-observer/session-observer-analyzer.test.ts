import { access, writeFile } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProcessResult, ProcessSpec } from '../../shared/child-process/run-process'
import type { SessionObserverAnalysis, SessionObserverSession } from '../../shared/session-observer'

const runProcessMock = vi.hoisted(() => vi.fn<(spec: ProcessSpec) => Promise<ProcessResult>>())

vi.mock('../../shared/child-process/run-process', () => ({ runProcess: runProcessMock }))

import { CodexSessionObserverAnalyzer } from './session-observer-analyzer'

const analysis: SessionObserverAnalysis = {
  summary: '分析完成。',
  goal: '完成配置验证',
  status: 'completed',
  progress: ['已执行'],
  completed: ['已验证'],
  nextSteps: [],
  blockers: [],
  needsUserAttention: false,
  confidence: 0.9
}

const session: SessionObserverSession = {
  id: 'pane-1',
  paneKey: 'pane-1',
  tabId: 'tab-1',
  worktreeId: 'workspace-1',
  agentType: 'codex',
  model: 'gpt-5.6-luna',
  lifecycleState: 'done',
  prompt: '验证分析配置',
  latestOutput: '已经完成。',
  title: 'Codex',
  turns: [
    {
      id: 'turn-1',
      userInput: '验证分析配置',
      agentOutput: '已经完成。',
      completedAt: 1_000,
      contextIncomplete: false
    }
  ],
  analysisState: 'queued',
  analysis: null,
  analysisError: null,
  manualStatusOverride: null,
  updatedAt: 1_000,
  completedAt: 1_000
}

function success(stdout = ''): ProcessResult {
  return { code: 0, signal: null, stdout, stderr: '', timedOut: false }
}

describe('CodexSessionObserverAnalyzer', () => {
  beforeEach(() => {
    runProcessMock.mockReset()
    delete process.env.ORCA_TEST_ANALYZER_VALUE
  })

  afterEach(() => {
    delete process.env.ORCA_TEST_ANALYZER_VALUE
  })

  it('runs the selected stdout adapter with its schema in the isolated prompt', async () => {
    process.env.ORCA_TEST_ANALYZER_VALUE = 'must-not-leak'
    runProcessMock.mockResolvedValue(success(JSON.stringify({ result: JSON.stringify(analysis) })))
    const analyzer = new CodexSessionObserverAnalyzer({ timeoutMs: 321 })

    await expect(
      analyzer.analyze(session, {
        agent: 'claude',
        model: 'sonnet',
        thinkingLevel: 'low',
        command: 'npx --yes claude-wrapper'
      })
    ).resolves.toEqual(analysis)

    const spec = runProcessMock.mock.calls[0]?.[0]
    expect(spec).toMatchObject({
      program: 'npx',
      timeoutMs: 321,
      maxOutputBytes: 512 * 1024
    })
    expect(spec?.args?.slice(0, 3)).toEqual(['--yes', 'claude-wrapper', '-p'])
    expect(spec?.args).toEqual(expect.arrayContaining(['--model', 'sonnet', '--effort', 'low']))
    expect(spec?.cwd).toMatch(/orcb-session-observer-/)
    expect(spec?.input).toContain('JSON Schema：')
    expect(spec?.input).toContain('needsUserAttention')
    expect(spec?.input).toContain('验证分析配置')
    expect(spec?.env?.ORCB_SESSION_OBSERVER_ANALYZER).toBe('1')
    expect(spec?.env?.ORCA_TEST_ANALYZER_VALUE).toBeUndefined()
    await expect(access(String(spec?.cwd))).rejects.toThrow()
  })

  it('reads the Codex result file and removes the temporary directory', async () => {
    let outputPath = ''
    runProcessMock.mockImplementation(async (spec) => {
      const args = [...(spec.args ?? [])]
      outputPath = args[args.indexOf('--output-last-message') + 1] ?? ''
      await writeFile(outputPath, JSON.stringify(analysis))
      return success('ignored progress output')
    })
    const analyzer = new CodexSessionObserverAnalyzer({ command: 'codex-wrapper' })

    await expect(
      analyzer.analyze(session, {
        agent: 'codex',
        model: 'gpt-5.6-luna',
        thinkingLevel: 'max'
      })
    ).resolves.toEqual(analysis)

    expect(runProcessMock.mock.calls[0]?.[0]).toMatchObject({ program: 'codex-wrapper' })
    expect(outputPath).not.toBe('')
    await expect(access(outputPath)).rejects.toThrow()
  })

  it('reports a bounded process failure and still cleans up its cwd', async () => {
    runProcessMock.mockResolvedValue({
      code: 2,
      signal: null,
      stdout: '',
      stderr: `first line\n${'x'.repeat(400)}`,
      timedOut: false
    })
    const analyzer = new CodexSessionObserverAnalyzer()

    await expect(
      analyzer.analyze(session, {
        agent: 'pi',
        model: 'github-copilot/gpt-5.4-mini',
        thinkingLevel: 'low'
      })
    ).rejects.toThrow(`x`.repeat(280))

    const cwd = runProcessMock.mock.calls[0]?.[0].cwd
    await expect(access(String(cwd))).rejects.toThrow()
  })

  it('rejects a truncated stdout result instead of accepting partial output', async () => {
    runProcessMock.mockResolvedValue({
      ...success(JSON.stringify(analysis)),
      outputTruncated: true
    })
    const analyzer = new CodexSessionObserverAnalyzer()

    await expect(
      analyzer.analyze(session, {
        agent: 'claude',
        model: 'sonnet',
        thinkingLevel: 'low'
      })
    ).rejects.toThrow('分析器输出过长')
  })
})
