import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type MockWindow = {
  isDestroyed: () => boolean
  webContents: { isDestroyed: () => boolean; send: ReturnType<typeof vi.fn> }
}

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  const service = {
    start: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    snapshot: vi.fn(async () => ({ generatedAt: 1, sessions: [] })),
    reanalyze: vi.fn(() => false),
    updateManualStatus: vi.fn(async () => false)
  }
  return {
    handlers,
    service,
    ipcMain: {
      removeHandler: vi.fn(),
      handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
        handlers.set(channel, handler)
    },
    app: { getPath: vi.fn(() => '/tmp/orcb-test'), focus: vi.fn() },
    SessionObserverService: class {
      start = service.start
      subscribe = service.subscribe
      snapshot = service.snapshot
      reanalyze = service.reanalyze
      updateManualStatus = service.updateManualStatus
    },
    JsonSessionObserverStateStore: vi.fn(),
    observerWindow: null as MockWindow | null,
    mainWindow: null as MockWindow | null,
    isObserverRenderer: vi.fn<(sender: unknown) => boolean>(() => false),
    isTrustedUIRenderer: vi.fn<(sender: unknown) => boolean>(() => false),
    getTrustedWindow: vi.fn<() => MockWindow | null>(() => null),
    safelyRevealWindow: vi.fn(),
    isBackgroundLaunch: vi.fn(() => true)
  }
})

vi.mock('electron', () => ({ app: mocks.app, ipcMain: mocks.ipcMain }))
vi.mock('../agent-hooks/server', () => ({ agentHookServer: {} }))
vi.mock('../session-observer/session-observer-service', () => ({
  SessionObserverService: mocks.SessionObserverService
}))
vi.mock('../session-observer/session-observer-state-store', () => ({
  JsonSessionObserverStateStore: mocks.JsonSessionObserverStateStore
}))
vi.mock('../window/session-observer-window', () => ({
  createOrFocusSessionObserver: vi.fn(),
  getSessionObserverWindow: () => mocks.observerWindow,
  isSessionObserverRenderer: mocks.isObserverRenderer
}))
vi.mock('./ui', () => ({
  getTrustedUIRendererWindow: mocks.getTrustedWindow,
  isTrustedUIRenderer: mocks.isTrustedUIRenderer
}))
vi.mock('../window/focus-existing-window', () => ({
  safelyRevealWindow: mocks.safelyRevealWindow
}))
vi.mock('../window/foreground-activation-policy', () => ({
  isBackgroundLaunch: mocks.isBackgroundLaunch
}))

import { registerSessionObserverHandlers } from './session-observer'

const observerSender = { id: 2 }
const untrustedSender = { id: 3 }
const validCloseArgs = {
  worktreeId: 'workspace-1',
  tabId: 'tab-1',
  paneKey: 'tab-1:leaf-1',
  ptyId: 'pty-1'
}

function eventFor(sender: unknown): unknown {
  return { sender }
}

describe('registerSessionObserverHandlers', () => {
  beforeEach(() => {
    mocks.handlers.clear()
    mocks.observerWindow = null
    mocks.mainWindow = {
      isDestroyed: () => false,
      webContents: {
        isDestroyed: () => false,
        send: vi.fn()
      }
    }
    mocks.getTrustedWindow.mockReturnValue(mocks.mainWindow)
    mocks.isObserverRenderer.mockImplementation((sender) => sender === observerSender)
    mocks.isTrustedUIRenderer.mockReturnValue(false)
    registerSessionObserverHandlers({} as never)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('forwards a valid close request only from the observer renderer', () => {
    const close = mocks.handlers.get('sessionObserver:close')!
    const mainWindow = mocks.mainWindow
    if (!mainWindow) {
      throw new Error('main window mock missing')
    }
    expect(close(eventFor(untrustedSender), validCloseArgs)).toBe(false)
    expect(close(eventFor(observerSender), validCloseArgs)).toBe(true)
    expect(mocks.safelyRevealWindow).toHaveBeenCalledWith(mainWindow)
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      'ui:closeSessionObserver',
      validCloseArgs
    )
  })

  it('rejects malformed close targets and missing main windows', () => {
    const close = mocks.handlers.get('sessionObserver:close')!
    expect(close(eventFor(observerSender), { ...validCloseArgs, ptyId: 42 })).toBe(false)
    expect(close(eventFor(observerSender), { ...validCloseArgs, ptyId: '' })).toBe(false)
    expect(close(eventFor(observerSender), { ...validCloseArgs, tabId: null })).toBe(false)
    expect(close(eventFor(observerSender), { ...validCloseArgs, worktreeId: '' })).toBe(false)

    mocks.getTrustedWindow.mockReturnValue(null)
    expect(close(eventFor(observerSender), validCloseArgs)).toBe(false)
  })

  it('keeps the existing reveal relay restricted to the observer renderer', () => {
    const reveal = mocks.handlers.get('sessionObserver:reveal')!
    const mainWindow = mocks.mainWindow
    if (!mainWindow) {
      throw new Error('main window mock missing')
    }
    const args = { worktreeId: 'workspace-1', tabId: 'tab-1', paneKey: 'tab-1:leaf-1' }
    expect(reveal(eventFor(untrustedSender), args)).toBe(false)
    expect(reveal(eventFor(observerSender), args)).toBe(true)
    expect(mainWindow.webContents.send).toHaveBeenCalledWith('ui:revealSessionObserver', args)
  })
})
