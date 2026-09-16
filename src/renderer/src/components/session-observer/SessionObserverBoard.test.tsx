// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionObserverSessionView } from '../../../../shared/session-observer'
import { SessionObserverBoard } from './SessionObserverBoard'

function session(id: string): SessionObserverSessionView {
  return {
    id,
    paneKey: id,
    tabId: 'tab-1',
    worktreeId: 'repo-one::/work/one',
    agentType: 'codex',
    model: null,
    lifecycleState: 'working',
    prompt: '处理需求',
    latestOutput: null,
    title: null,
    turns: [],
    analysisState: 'awaiting_output',
    analysis: null,
    analysisError: null,
    manualStatusOverride: null,
    updatedAt: 1,
    completedAt: null,
    ptyId: null,
    live: false,
    terminalState: 'unknown',
    modelStatus: 'unclear',
    effectiveStatus: 'unclear'
  }
}

describe('SessionObserverBoard', () => {
  afterEach(cleanup)

  it('renders flat multi-select project controls and filtered counts', () => {
    const onToggleProject = vi.fn()
    render(
      <SessionObserverBoard
        sessions={[session('one')]}
        totalSessionCount={3}
        projectOptions={[
          { key: 'repo:repo-one', label: 'Orca', count: 1, latestUpdatedAt: 1 },
          { key: 'repo:repo-two', label: 'Console', count: 2, latestUpdatedAt: 2 }
        ]}
        selectedProjectKeys={new Set(['repo:repo-one'])}
        selectedSessionId={null}
        onSelect={() => {}}
        onToggleProject={onToggleProject}
      />
    )

    expect(screen.getByText('1 / 3 个会话')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '全部项目（3）' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.getByRole('button', { name: 'Orca（1）' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: 'Orca（1）' })).toHaveAttribute(
      'data-selected',
      'true'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Console（2）' }))
    expect(onToggleProject).toHaveBeenCalledWith('repo:repo-two')
  })

  it('hides the filter controls when there are no project options', () => {
    render(
      <SessionObserverBoard
        sessions={[]}
        totalSessionCount={0}
        projectOptions={[]}
        selectedProjectKeys={new Set()}
        selectedSessionId={null}
        onSelect={() => {}}
        onToggleProject={() => {}}
      />
    )

    expect(screen.queryByLabelText('按项目筛选会话')).not.toBeInTheDocument()
    expect(screen.getByText('0 个会话')).toBeInTheDocument()
  })
})
