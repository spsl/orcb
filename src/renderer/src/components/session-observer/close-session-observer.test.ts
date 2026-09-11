// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  activateAndRevealWorkspace: vi.fn(),
  activateTabAndFocusPane: vi.fn(),
  tabsByWorktree: {
    'workspace-1': [{ id: 'tab-1' }]
  }
}))

vi.mock('@/lib/worktree-activation', () => ({
  activateAndRevealWorkspace: mocks.activateAndRevealWorkspace
}))
vi.mock('@/lib/activate-tab-and-focus-pane', () => ({
  activateTabAndFocusPane: mocks.activateTabAndFocusPane
}))
vi.mock('@/store', () => ({
  useAppStore: { getState: () => ({ tabsByWorktree: mocks.tabsByWorktree }) }
}))

import { closeSessionObserverSession } from './close-session-observer'

const args = (overrides: Record<string, unknown> = {}) => ({
  worktreeId: 'workspace-1',
  tabId: 'tab-1',
  paneKey: 'tab-1:11111111-1111-4111-8111-111111111111',
  ptyId: 'pty-1',
  ...overrides
})

describe('closeSessionObserverSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.tabsByWorktree['workspace-1'] = [{ id: 'tab-1' }]
    mocks.activateAndRevealWorkspace.mockReturnValue({ primaryTabId: null })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
  })

  it('activates the source pane and dispatches a guarded close request', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent')
    expect(closeSessionObserverSession(args())).toBe(true)
    expect(mocks.activateTabAndFocusPane).toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'orca-request-close-terminal-pane' })
    )
  })

  it('rejects missing tab or PTY and invalid pane keys', () => {
    expect(closeSessionObserverSession(args({ tabId: null }))).toBe(false)
    expect(closeSessionObserverSession(args({ ptyId: null }))).toBe(false)
    expect(closeSessionObserverSession(args({ paneKey: 'legacy-pane' }))).toBe(false)
    expect(mocks.activateTabAndFocusPane).not.toHaveBeenCalled()
  })

  it('rejects a tab owned by another workspace or no longer present', () => {
    expect(closeSessionObserverSession(args({ worktreeId: 'workspace-2' }))).toBe(false)
    mocks.tabsByWorktree['workspace-1'] = []
    expect(closeSessionObserverSession(args())).toBe(false)
    expect(mocks.activateAndRevealWorkspace).not.toHaveBeenCalled()
  })
})
