import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionObserverCloseArgs } from '../../shared/session-observer'

const ipcRenderer = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn()
}))

vi.mock('electron', () => ({ ipcRenderer }))

import { sessionObserverApi } from './session-observer-bridge'

const closeArgs: SessionObserverCloseArgs = {
  worktreeId: 'workspace-1',
  tabId: 'tab-1',
  paneKey: 'tab-1:leaf-1',
  ptyId: 'pty-1'
}

describe('sessionObserverApi close bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invokes the close IPC channel with the complete target', async () => {
    ipcRenderer.invoke.mockResolvedValue(true)
    await expect(sessionObserverApi.close(closeArgs)).resolves.toBe(true)
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('sessionObserver:close', closeArgs)
  })

  it('registers and removes the main-renderer close relay listener', () => {
    const onClose = vi.fn()
    const remove = sessionObserverApi.onClose(onClose)
    expect(ipcRenderer.on).toHaveBeenCalledWith('ui:closeSessionObserver', expect.any(Function))
    const listener = ipcRenderer.on.mock.calls[0]?.[1]
    listener?.({}, closeArgs)
    expect(onClose).toHaveBeenCalledWith(closeArgs)

    remove()
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith('ui:closeSessionObserver', listener)
  })
})
