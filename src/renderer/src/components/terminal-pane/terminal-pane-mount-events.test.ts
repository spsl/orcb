// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REQUEST_CLOSE_TERMINAL_PANE_EVENT } from '@/constants/terminal'

const mocks = vi.hoisted(() => ({
  registerSplit: vi.fn(() => vi.fn()),
  applyClose: vi.fn(() => 'ignored' as const)
}))

vi.mock('@/runtime/web-runtime-session', () => ({
  consumePendingWebRuntimeSplitMirrorTelemetry: vi.fn()
}))
vi.mock('@/runtime/sync-runtime-graph', () => ({ scheduleRuntimeGraphSync: vi.fn() }))
vi.mock('../terminal/terminal-tab-actions', () => ({ closeTerminalTab: vi.fn() }))
vi.mock('@/store', () => ({ useAppStore: { getState: () => ({ terminalLayoutsByTabId: {} }) } }))
vi.mock('./terminal-pane-lifecycle-primitives', () => ({
  splitPaneWithOneShotStartup: vi.fn(),
  recordRuntimeCreatedTerminalPaneSplit: vi.fn()
}))
vi.mock('./terminal-pane-lifecycle-close', () => ({
  applyTerminalPaneCloseRequest: mocks.applyClose
}))
vi.mock('./terminal-pane-split-request-routing', () => ({
  registerTerminalPaneSplitRequestHandler: mocks.registerSplit,
  resolveTerminalPaneSplitSourceId: vi.fn(() => -1)
}))

import { installTerminalPaneMountEvents } from './terminal-pane-mount-events'

describe('installTerminalPaneMountEvents close relay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('routes a matching observer request to the user-confirming close controller', () => {
    const manager = {
      getNumericIdForLeaf: vi.fn(() => 7),
      getPanes: vi.fn(() => [])
    }
    const managerRef = { current: manager }
    const paneTransportsRef = {
      current: new Map([[7, { getPtyId: () => 'pty-1' }]])
    }
    const onRequestClosePane = vi.fn()
    const remove = installTerminalPaneMountEvents({
      manager: manager as never,
      deps: {
        tabId: 'tab-1',
        worktreeId: 'workspace-1',
        isActive: true,
        managerRef: managerRef as never,
        persistLayoutSnapshot: vi.fn(),
        syncCanExpandState: vi.fn(),
        queueResizeAll: vi.fn(),
        onRequestClosePane,
        paneTransportsRef: paneTransportsRef as never
      },
      ptyDeps: {} as never
    })

    window.dispatchEvent(
      new CustomEvent(REQUEST_CLOSE_TERMINAL_PANE_EVENT, {
        detail: { tabId: 'tab-1', leafId: 'leaf-1', expectedPtyId: 'pty-1' }
      })
    )
    expect(onRequestClosePane).toHaveBeenCalledWith(7)

    remove()
    window.dispatchEvent(
      new CustomEvent(REQUEST_CLOSE_TERMINAL_PANE_EVENT, {
        detail: { tabId: 'tab-1', leafId: 'leaf-1', expectedPtyId: 'pty-1' }
      })
    )
    expect(onRequestClosePane).toHaveBeenCalledTimes(1)
  })
})
