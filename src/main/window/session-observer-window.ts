import { BrowserWindow, nativeTheme, type WebContents } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { isBackgroundLaunch, showWindowWithoutStealingFocus } from './foreground-activation-policy'
import { installPrivilegedWindowNavigationPolicy } from './privileged-window-navigation'

const MIN_WIDTH = 960
const MIN_HEIGHT = 640
const DEFAULT_WIDTH = 1_560
const DEFAULT_HEIGHT = 960
const SESSION_OBSERVER_PARTITION = 'orcb-session-observer'

let sessionObserverWindow: BrowserWindow | null = null

export function getSessionObserverWindow(): BrowserWindow | null {
  return sessionObserverWindow &&
    !sessionObserverWindow.isDestroyed() &&
    !sessionObserverWindow.webContents.isDestroyed()
    ? sessionObserverWindow
    : null
}

export function isSessionObserverRenderer(sender: WebContents): boolean {
  return getSessionObserverWindow()?.webContents === sender
}

function loadSessionObserver(window: BrowserWindow): void {
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(`${process.env.ELECTRON_RENDERER_URL}/session-observer.html`)
    return
  }
  void window.loadFile(join(__dirname, '../renderer/session-observer.html'))
}

/** Opens the standalone observer surface without changing the Agent Dashboard. */
export function createOrFocusSessionObserver(): BrowserWindow {
  const existing = getSessionObserverWindow()
  if (existing) {
    if (existing.isMinimized()) {
      existing.restore()
    }
    if (!isBackgroundLaunch()) {
      existing.focus()
    }
    return existing
  }

  const window = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: 'orcb 会话分析',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0a0a' : '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      // Chromium shares zoom by origin; the observer needs an isolated renderer
      // session so a user can inspect it without changing the main workspace.
      partition: SESSION_OBSERVER_PARTITION,
      webviewTag: false
    }
  })
  installPrivilegedWindowNavigationPolicy(window.webContents)
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false)
  )
  window.webContents.session.setPermissionCheckHandler(() => false)
  sessionObserverWindow = window

  window.once('ready-to-show', () => {
    showWindowWithoutStealingFocus(window)
  })
  window.on('closed', () => {
    if (sessionObserverWindow === window) {
      sessionObserverWindow = null
    }
  })

  loadSessionObserver(window)
  return window
}

export function closeSessionObserver(): void {
  const window = getSessionObserverWindow()
  if (window) {
    window.close()
  }
  sessionObserverWindow = null
}
