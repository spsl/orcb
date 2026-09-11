// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { SessionObserverSessionView } from '../../../../shared/session-observer'
import { SessionObserverDetailDialog } from './SessionObserverDetailDialog'

vi.mock('@/components/dashboard-popout/AgentTerminalPreview', () => ({
  AgentTerminalPreview: ({ ptyId }: { ptyId: string }) => (
    <div data-testid="terminal-preview" data-pty-id={ptyId} />
  )
}))

function session(overrides: Partial<SessionObserverSessionView> = {}): SessionObserverSessionView {
  return {
    id: 'tab-1:leaf-1',
    paneKey: 'tab-1:leaf-1',
    tabId: 'tab-1',
    worktreeId: 'workspace-1',
    agentType: 'codex',
    model: 'gpt-5.6',
    lifecycleState: 'done',
    prompt: '实现会话看板',
    latestOutput: '已完成',
    title: '会话看板实现',
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

afterEach(() => {
  cleanup()
})

describe('SessionObserverDetailDialog', () => {
  it('renders observer details alongside the native attached terminal', () => {
    const onOpenChange = vi.fn()
    render(
      <SessionObserverDetailDialog
        session={session()}
        reanalysisPending={false}
        statusUpdatePending={false}
        onOpenChange={onOpenChange}
        onReanalyze={() => {}}
        onManualStatusChange={() => {}}
      />
    )

    expect(screen.getByRole('dialog')).toHaveTextContent('看板状态')
    expect(screen.getByText('会话记录（0）')).toBeInTheDocument()
    expect(screen.getByTestId('terminal-preview')).toHaveAttribute('data-pty-id', 'pty-1')

    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
