import { describe, expect, it } from 'vitest'
import type { SessionObserverSessionView } from '../../../../shared/session-observer'
import {
  sessionColumn,
  sessionGitBranchLabel,
  sessionTitle,
  sessionWorkspaceLabel
} from './session-observer-presentation'

function session(overrides: Partial<SessionObserverSessionView> = {}): SessionObserverSessionView {
  return {
    id: 'tab-1:leaf-1',
    paneKey: 'tab-1:leaf-1',
    tabId: 'tab-1',
    worktreeId: 'workspace-1',
    agentType: 'codex',
    model: null,
    lifecycleState: 'done',
    prompt: '实现会话看板',
    latestOutput: '已完成',
    title: null,
    turns: [],
    analysisState: 'ready',
    analysis: null,
    analysisError: null,
    manualStatusOverride: null,
    updatedAt: 1_000,
    completedAt: 1_000,
    ptyId: 'pty-1',
    live: true,
    terminalState: 'live',
    modelStatus: 'unclear',
    effectiveStatus: 'unclear',
    ...overrides
  }
}

describe('session observer board presentation', () => {
  it('places blocked work in the observer needs-action column', () => {
    expect(sessionColumn(session({ effectiveStatus: 'blocked' }))).toBe('waiting_for_user')
  })

  it('puts a confirmed ended terminal in closed ahead of its last analysis verdict', () => {
    expect(
      sessionColumn(session({ live: false, terminalState: 'closed', effectiveStatus: 'completed' }))
    ).toBe('closed')
  })

  it('keeps a live unknown session in the triage column', () => {
    expect(sessionColumn(session({ effectiveStatus: 'unclear' }))).toBe('unclear')
  })

  it('does not turn a runtime outage into a closed-terminal verdict', () => {
    expect(sessionColumn(session({ live: false, terminalState: 'unknown' }))).toBe('unclear')
  })

  it('formats the last two workspace path segments across platforms', () => {
    expect(
      sessionWorkspaceLabel(session({ worktreePath: '/Users/ada/projects/orcb' }))
    ).toBe('projects/orcb')
    expect(sessionWorkspaceLabel(session({ worktreePath: 'C:\\Users\\Ada\\repo\\app' }))).toBe(
      'repo/app'
    )
  })

  it('normalizes branch refs and hides missing branches', () => {
    expect(sessionGitBranchLabel(session({ gitBranch: 'refs/heads/feature/session-card' }))).toBe(
      'feature/session-card'
    )
    expect(sessionGitBranchLabel(session({ gitBranch: '' }))).toBeNull()
  })

  it('prefers the generated analysis title over the terminal title', () => {
    expect(
      sessionTitle(
        session({
          title: 'Codex',
          analysis: {
            title: '重构会话分析配置',
            summary: '正在重构分析配置。',
            goal: '重构分析配置',
            status: 'in_progress',
            progress: [],
            completed: [],
            nextSteps: [],
            blockers: [],
            needsUserAttention: false,
            confidence: 0.8
          }
        })
      )
    ).toBe('重构会话分析配置')
  })
})
