// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import type { SessionObserverSessionView } from '../../../../shared/session-observer'
import { TooltipProvider } from '@/components/ui/tooltip'
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

function renderDialog(element: ReactElement) {
  return render(<TooltipProvider>{element}</TooltipProvider>)
}

afterEach(() => {
  cleanup()
})

describe('SessionObserverDetailDialog', () => {
  it('renders observer details alongside the native attached terminal', () => {
    const onOpenChange = vi.fn()
    renderDialog(
      <SessionObserverDetailDialog
        session={session()}
        reanalysisPending={false}
        statusUpdatePending={false}
        onOpenChange={onOpenChange}
        onReanalyze={() => {}}
        onManualStatusChange={() => {}}
        onReveal={() => {}}
        onCloseTerminal={() => {}}
        closePending={false}
      />
    )

    expect(screen.getByRole('dialog')).toHaveTextContent('看板状态')
    expect(screen.getByText('会话记录（0）')).toBeInTheDocument()
    expect(screen.getByTestId('terminal-preview')).toHaveAttribute('data-pty-id', 'pty-1')

    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('offers to open the source worktree and reports the selected session', () => {
    const onReveal = vi.fn()
    const sourceSession = session()
    renderDialog(
      <SessionObserverDetailDialog
        session={sourceSession}
        reanalysisPending={false}
        statusUpdatePending={false}
        onOpenChange={() => {}}
        onReanalyze={() => {}}
        onManualStatusChange={() => {}}
        onReveal={onReveal}
        onCloseTerminal={() => {}}
        closePending={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '打开工作树' }))
    expect(onReveal).toHaveBeenCalledWith(sourceSession)
  })

  it('hides the source worktree action when no worktree is available', () => {
    renderDialog(
      <SessionObserverDetailDialog
        session={session({ worktreeId: null })}
        reanalysisPending={false}
        statusUpdatePending={false}
        onOpenChange={() => {}}
        onReanalyze={() => {}}
        onManualStatusChange={() => {}}
        onReveal={() => {}}
        onCloseTerminal={() => {}}
        closePending={false}
      />
    )

    expect(screen.queryByRole('button', { name: '打开工作树' })).not.toBeInTheDocument()
  })

  it('closes a live terminal through the provided callback', () => {
    const calls: string[] = []
    const onOpenChange = vi.fn(() => calls.push('dialog'))
    const onCloseTerminal = vi.fn(() => calls.push('terminal'))
    const sourceSession = session()
    renderDialog(
      <SessionObserverDetailDialog
        session={sourceSession}
        reanalysisPending={false}
        statusUpdatePending={false}
        onOpenChange={onOpenChange}
        onReanalyze={() => {}}
        onManualStatusChange={() => {}}
        onReveal={() => {}}
        onCloseTerminal={onCloseTerminal}
        closePending={false}
      />
    )

    const closeControl = screen.getByRole('button', { name: '关闭终端' })
    expect(closeControl).toHaveAttribute('data-size', 'icon-xs')
    expect(closeControl).not.toHaveTextContent('关闭终端')
    fireEvent.click(closeControl)
    expect(calls).toEqual(['dialog', 'terminal'])
    expect(onCloseTerminal).toHaveBeenCalledWith(sourceSession)
    expect(screen.queryByText('关闭终端')).not.toBeInTheDocument()
  })

  it('does not offer terminal close for closed or unknown terminals', () => {
    for (const terminalState of ['closed', 'unknown'] as const) {
      const view = renderDialog(
        <SessionObserverDetailDialog
          session={session({ terminalState })}
          reanalysisPending={false}
          statusUpdatePending={false}
          onOpenChange={() => {}}
          onReanalyze={() => {}}
          onManualStatusChange={() => {}}
          onReveal={() => {}}
          onCloseTerminal={() => {}}
          closePending={false}
        />
      )
      expect(screen.queryByRole('button', { name: '关闭终端' })).not.toBeInTheDocument()
      view.unmount()
    }
  })

  it('disables terminal close while the request is pending', () => {
    renderDialog(
      <SessionObserverDetailDialog
        session={session()}
        reanalysisPending={false}
        statusUpdatePending={false}
        onOpenChange={() => {}}
        onReanalyze={() => {}}
        onManualStatusChange={() => {}}
        onReveal={() => {}}
        onCloseTerminal={() => {}}
        closePending
      />
    )
    expect(screen.getByRole('button', { name: '关闭终端' })).toBeDisabled()
  })
})
