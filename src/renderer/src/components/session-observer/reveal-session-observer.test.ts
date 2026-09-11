import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionObserverRevealArgs } from '../../../../shared/session-observer'

const mocks = vi.hoisted(() => ({
  activateAndRevealWorkspace: vi.fn(),
  activateTabAndFocusPane: vi.fn()
}))

vi.mock('@/lib/worktree-activation', () => ({
  activateAndRevealWorkspace: mocks.activateAndRevealWorkspace
}))

vi.mock('@/lib/activate-tab-and-focus-pane', () => ({
  activateTabAndFocusPane: mocks.activateTabAndFocusPane
}))

import { revealSessionObserverSession } from './reveal-session-observer'

const paneKey = 'tab-1:11111111-1111-4111-8111-111111111111'

function args(overrides: Partial<SessionObserverRevealArgs> = {}): SessionObserverRevealArgs {
  return {
    worktreeId: 'workspace-1',
    tabId: 'tab-1',
    paneKey,
    ...overrides
  }
}

describe('revealSessionObserverSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.activateAndRevealWorkspace.mockReturnValue({ primaryTabId: null })
  })

  it('activates the workspace and focuses the matching pane', () => {
    expect(revealSessionObserverSession(args())).toBe(true)
    expect(mocks.activateAndRevealWorkspace).toHaveBeenCalledWith('workspace-1')
    expect(mocks.activateTabAndFocusPane).toHaveBeenCalledWith(
      'tab-1',
      '11111111-1111-4111-8111-111111111111',
      { flashFocusedPane: true }
    )
  })

  it('still focuses the tab when the pane key cannot be resolved', () => {
    expect(revealSessionObserverSession(args({ paneKey: 'legacy-pane' }))).toBe(true)
    expect(mocks.activateTabAndFocusPane).toHaveBeenCalledWith('tab-1', null, {
      flashFocusedPane: true
    })
  })

  it('only activates the workspace when no tab is available', () => {
    expect(revealSessionObserverSession(args({ tabId: null }))).toBe(true)
    expect(mocks.activateTabAndFocusPane).not.toHaveBeenCalled()
  })

  it('returns false when workspace activation fails', () => {
    mocks.activateAndRevealWorkspace.mockReturnValue(false)
    expect(revealSessionObserverSession(args())).toBe(false)
    expect(mocks.activateTabAndFocusPane).not.toHaveBeenCalled()
  })
})
