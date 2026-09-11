import { describe, expect, it, vi } from 'vitest'
import type { RequestCloseTerminalPaneDetail } from '@/constants/terminal'
import { handleRequestCloseTerminalPaneDetail } from './request-close-terminal-pane-event'

describe('handleRequestCloseTerminalPaneDetail', () => {
  const manager = { getNumericIdForLeaf: vi.fn(() => 4) }

  it('closes the resolved pane when tab and PTY match', () => {
    const close = vi.fn()
    handleRequestCloseTerminalPaneDetail(
      { tabId: 'tab-1', leafId: 'leaf-1', expectedPtyId: 'pty-1' },
      { tabId: 'tab-1', manager, getPtyIdForPane: () => 'pty-1', handleRequestClosePane: close }
    )
    expect(close).toHaveBeenCalledWith(4)
  })

  it('consumes a request so duplicate mounted surfaces cannot close twice', () => {
    const close = vi.fn()
    const detail: RequestCloseTerminalPaneDetail = {
      tabId: 'tab-1',
      leafId: 'leaf-1',
      expectedPtyId: 'pty-1'
    }
    const deps = {
      tabId: 'tab-1',
      manager,
      getPtyIdForPane: () => 'pty-1',
      handleRequestClosePane: close
    }
    handleRequestCloseTerminalPaneDetail(detail, deps)
    handleRequestCloseTerminalPaneDetail(detail, deps)
    expect(close).toHaveBeenCalledOnce()
    expect(detail.handled).toBe(true)
  })

  it('ignores stale or mismatched requests', () => {
    const close = vi.fn()
    handleRequestCloseTerminalPaneDetail(
      { tabId: 'other', leafId: 'leaf-1' },
      { tabId: 'tab-1', manager, getPtyIdForPane: () => 'pty-1', handleRequestClosePane: close }
    )
    handleRequestCloseTerminalPaneDetail(
      { tabId: 'tab-1', leafId: 'leaf-1', expectedPtyId: 'pty-2' },
      { tabId: 'tab-1', manager, getPtyIdForPane: () => 'pty-1', handleRequestClosePane: close }
    )
    expect(close).not.toHaveBeenCalled()
  })

  it('ignores a leaf that is no longer mounted', () => {
    const close = vi.fn()
    handleRequestCloseTerminalPaneDetail(
      { tabId: 'tab-1', leafId: 'leaf-1' },
      {
        tabId: 'tab-1',
        manager: { getNumericIdForLeaf: () => null },
        getPtyIdForPane: () => 'pty-1',
        handleRequestClosePane: close
      }
    )
    expect(close).not.toHaveBeenCalled()
  })
})
