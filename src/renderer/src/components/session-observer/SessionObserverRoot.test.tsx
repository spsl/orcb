// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  SessionObserverSessionView,
  SessionObserverSnapshot
} from '../../../../shared/session-observer'

const mocks = vi.hoisted(() => {
  const appState: { repos: { id: string; displayName: string; path: string }[] } = { repos: [] }
  const noSnapshotListener = (): ((snapshot: SessionObserverSnapshot) => void) | null => null
  return {
    requestSnapshot: vi.fn<() => Promise<void>>(),
    close: vi.fn<(args: unknown) => Promise<boolean>>(),
    onSnapshot: vi.fn(),
    snapshotListener: noSnapshotListener(),
    appState,
    useAppStore: (selector: (state: typeof appState) => unknown) => selector(appState)
  }
})

vi.mock('@/hooks/useAppMenuPaste', () => ({ useAppMenuPaste: () => undefined }))
vi.mock('@/hooks/useAppMenuSelectionActions', () => ({
  useAppMenuSelectionActions: () => undefined
}))
vi.mock('@/store', () => ({ useAppStore: mocks.useAppStore }))
vi.mock('./SessionObserverBoard', () => ({
  SessionObserverBoard: ({
    sessions,
    projectOptions,
    selectedProjectKeys,
    onSelect,
    onToggleProject
  }: {
    sessions: SessionObserverSessionView[]
    projectOptions: { key: string; label: string }[]
    selectedProjectKeys: ReadonlySet<string>
    onSelect: (sessionId: string) => void
    onToggleProject: (projectKey: string | null) => void
  }) => (
    <>
      <span data-testid="筛选会话">{sessions.map(({ id }) => id).join(',')}</span>
      <button type="button" onClick={() => onToggleProject(null)}>
        全部项目
      </button>
      {projectOptions.map((project) => (
        <button
          key={project.key}
          type="button"
          aria-pressed={selectedProjectKeys.has(project.key)}
          onClick={() => onToggleProject(project.key)}
        >
          项目 {project.label}
        </button>
      ))}
      {sessions.length > 0 ? (
        <button type="button" onClick={() => onSelect(sessions[0].id)}>
          选择会话
        </button>
      ) : null}
    </>
  )
}))
vi.mock('./SessionObserverDetailDialog', () => ({
  SessionObserverDetailDialog: ({
    session,
    onCloseTerminal,
    onOpenChange,
    closePending
  }: {
    session: SessionObserverSessionView | null
    onCloseTerminal: (session: SessionObserverSessionView) => void
    onOpenChange: (open: boolean) => void
    closePending: boolean
  }) =>
    session ? (
      <button
        type="button"
        disabled={closePending}
        onClick={() => {
          onOpenChange(false)
          onCloseTerminal(session)
        }}
      >
        关闭终端
      </button>
    ) : null
}))
vi.mock('./SessionObserverAnalyzerSettings', () => ({
  SessionObserverAnalyzerSettings: () => <div>分析配置表单</div>
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
    mocks.appState.repos = []
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
    expect(screen.queryByRole('button', { name: '关闭终端' })).not.toBeInTheDocument()

    await act(async () => resolveClose(true))
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

  it('reveals analyzer settings only after the header action is selected', () => {
    render(<SessionObserverRoot />)

    expect(screen.queryByText('分析配置表单')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '分析设置' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('分析配置')
    expect(screen.getByText('分析配置表单')).toBeInTheDocument()
  })

  it('filters multiple projects locally and restores all projects after the final deselection', () => {
    mocks.appState.repos = [
      { id: 'repo-orca', displayName: 'Orca', path: '/work/orca' },
      { id: 'repo-console', displayName: 'Console', path: '/work/console' }
    ]
    const orca = { ...session(), id: 'orca', paneKey: 'orca', worktreeId: 'repo-orca::/work/orca' }
    const console = {
      ...session(),
      id: 'console',
      paneKey: 'console',
      worktreeId: 'repo-console::/work/console'
    }
    render(<SessionObserverRoot />)
    act(() => {
      mocks.snapshotListener?.({ generatedAt: 1, sessions: [orca, console] })
    })

    expect(screen.getByTestId('筛选会话')).toHaveTextContent('orca,console')
    fireEvent.click(screen.getByRole('button', { name: '项目 Orca' }))
    expect(screen.getByTestId('筛选会话')).toHaveTextContent('orca')
    fireEvent.click(screen.getByRole('button', { name: '项目 Console' }))
    expect(screen.getByTestId('筛选会话')).toHaveTextContent('orca,console')
    fireEvent.click(screen.getByRole('button', { name: '项目 Orca' }))
    fireEvent.click(screen.getByRole('button', { name: '项目 Console' }))
    expect(screen.getByTestId('筛选会话')).toHaveTextContent('orca,console')
  })
})
