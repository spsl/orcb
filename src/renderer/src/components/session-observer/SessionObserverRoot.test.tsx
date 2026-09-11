// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  SessionObserverSessionView,
  SessionObserverSnapshot
} from '../../../../shared/session-observer'

const mocks = vi.hoisted(() => ({
  requestSnapshot: vi.fn<() => Promise<void>>(),
  close: vi.fn<(args: unknown) => Promise<boolean>>(),
  onSnapshot: vi.fn(),
  snapshotListener: null as ((snapshot: SessionObserverSnapshot) => void) | null
}))

vi.mock('@/hooks/useAppMenuPaste', () => ({ useAppMenuPaste: () => undefined }))
vi.mock('@/hooks/useAppMenuSelectionActions', () => ({
  useAppMenuSelectionActions: () => undefined
}))
vi.mock('./SessionObserverBoard', () => ({
  SessionObserverBoard: ({
    sessions,
    onSelect
  }: {
    sessions: SessionObserverSessionView[]
    onSelect: (sessionId: string) => void
  }) =>
    sessions.length > 0 ? (
      <button type="button" onClick={() => onSelect(sessions[0].id)}>
        选择会话
      </button>
    ) : null
}))
vi.mock('./SessionObserverDetailDialog', () => ({
  SessionObserverDetailDialog: ({
    session,
    onCloseTerminal,
    closePending
  }: {
    session: SessionObserverSessionView | null
    onCloseTerminal: (session: SessionObserverSessionView) => void
    closePending: boolean
  }) =>
    session ? (
      <button type="button" disabled={closePending} onClick={() => onCloseTerminal(session)}>
        关闭终端
      </button>
    ) : null
}))

import { SessionObserverRoot } from './SessionObserverRoot'

function session(): SessionObserverSessionView {
  return {
    id: 'tab-1:leaf-1',
    paneKey: 'tab-1:leaf-1',
    tabId: 'tab-1',
    worktreeId: 'workspace-1',
    agentType: 'codex',
    model: 'gpt-5.6',
    lifecycleState: 'working',
    prompt: '处理需求',
    latestOutput: null,
    title: '需求会话',
    turns: [],
    analysisState: 'awaiting_output',
    analysis: null,
    analysisError: null,
    manualStatusOverride: null,
    updatedAt: 1,
    completedAt: null,
    ptyId: 'pty-1',
    live: true,
    terminalState: 'live',
    modelStatus: 'unclear',
    effectiveStatus: 'in_progress'
  }
}

describe('SessionObserverRoot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.snapshotListener = null
    mocks.requestSnapshot.mockResolvedValue(undefined)
    mocks.onSnapshot.mockImplementation((listener: (snapshot: SessionObserverSnapshot) => void) => {
      mocks.snapshotListener = listener
      return vi.fn()
    })
    Object.assign(window, {
      api: {
        sessionObserver: {
          requestSnapshot: mocks.requestSnapshot,
          onSnapshot: mocks.onSnapshot,
          close: mocks.close,
          reanalyze: vi.fn(),
          updateManualStatus: vi.fn(),
          reveal: vi.fn()
        }
      }
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('sends the selected session identity to the main renderer close relay', async () => {
    let resolveClose!: (value: boolean) => void
    mocks.close.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveClose = resolve
        })
    )
    const sourceSession = session()
    render(<SessionObserverRoot />)
    act(() => {
      mocks.snapshotListener?.({ generatedAt: 1, sessions: [sourceSession] })
    })
    fireEvent.click(await screen.findByRole('button', { name: '选择会话' }))
    const closeButton = screen.getByRole('button', { name: '关闭终端' })
    fireEvent.click(closeButton)

    expect(mocks.close).toHaveBeenCalledWith({
      worktreeId: 'workspace-1',
      tabId: 'tab-1',
      paneKey: 'tab-1:leaf-1',
      ptyId: 'pty-1'
    })
    expect(closeButton).toBeDisabled()

    await act(async () => resolveClose(true))
    await waitFor(() => expect(closeButton).not.toBeDisabled())
    expect(mocks.requestSnapshot).toHaveBeenCalled()
  })

  it('does not submit a close request for a non-live session', async () => {
    const sourceSession = { ...session(), terminalState: 'closed' as const, ptyId: null }
    render(<SessionObserverRoot />)
    act(() => {
      mocks.snapshotListener?.({ generatedAt: 1, sessions: [sourceSession] })
    })
    fireEvent.click(await screen.findByRole('button', { name: '选择会话' }))
    fireEvent.click(screen.getByRole('button', { name: '关闭终端' }))
    expect(mocks.close).not.toHaveBeenCalled()
  })
})
