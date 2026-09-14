import { app, ipcMain } from 'electron'
import { join } from 'node:path'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { agentHookServer } from '../agent-hooks/server'
import { SessionObserverService } from '../session-observer/session-observer-service'
import { JsonSessionObserverStateStore } from '../session-observer/session-observer-state-store'
import {
  SESSION_OBSERVER_ANALYSIS_STATUSES,
  type SessionObserverManualStatusOverride,
  type SessionObserverAnalysisStatus,
  type SessionObserverRevealArgs,
  type SessionObserverCloseArgs
} from '../../shared/session-observer'
import {
  createOrFocusSessionObserver,
  getSessionObserverWindow,
  isSessionObserverRenderer
} from '../window/session-observer-window'
import { getTrustedUIRendererWindow, isTrustedUIRenderer } from './ui'
import { safelyRevealWindow } from '../window/focus-existing-window'
import { isBackgroundLaunch } from '../window/foreground-activation-policy'
import type { Store } from '../persistence'
import type { SessionObserverAnalyzerAgent } from '../../shared/session-observer-analysis'

const SESSION_ID_MAX_LENGTH = 4_096

let observerService: SessionObserverService | null = null
let unsubscribeObserverChanges: (() => void) | null = null

function isValidSessionId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= SESSION_ID_MAX_LENGTH
}

function isValidManualStatusOverride(value: unknown): value is SessionObserverManualStatusOverride {
  return (
    value === null ||
    (typeof value === 'string' &&
      SESSION_OBSERVER_ANALYSIS_STATUSES.includes(value as SessionObserverAnalysisStatus))
  )
}

function isValidRevealArgs(value: unknown): value is SessionObserverRevealArgs {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const args = value as Record<string, unknown>
  return (
    typeof args.worktreeId === 'string' &&
    args.worktreeId.length > 0 &&
    args.worktreeId.length <= SESSION_ID_MAX_LENGTH &&
    (args.tabId === null ||
      (typeof args.tabId === 'string' &&
        args.tabId.length > 0 &&
        args.tabId.length <= SESSION_ID_MAX_LENGTH)) &&
    typeof args.paneKey === 'string' &&
    args.paneKey.length > 0 &&
    args.paneKey.length <= SESSION_ID_MAX_LENGTH
  )
}

function isValidCloseArgs(value: unknown): value is SessionObserverCloseArgs {
  if (!isValidRevealArgs(value)) {
    return false
  }
  const args = value as Record<string, unknown>
  const ptyId = args.ptyId
  return (
    typeof args.tabId === 'string' &&
    typeof ptyId === 'string' &&
    ptyId.length > 0 &&
    ptyId.length <= SESSION_ID_MAX_LENGTH
  )
}

function getObserverService(runtime: OrcaRuntimeService, store?: Store): SessionObserverService {
  if (observerService) {
    return observerService
  }
  observerService = new SessionObserverService({
    runtime,
    hookServer: agentHookServer,
    storage: new JsonSessionObserverStateStore(
      join(app.getPath('userData'), 'orcb-session-observer.json')
    ),
    getAnalyzerConfig: () => store?.getSettings().sessionObserverAnalysis,
    getAnalyzerCommand: (agent: SessionObserverAnalyzerAgent) =>
      store?.getSettings().agentCmdOverrides?.[agent]
  })
  observerService.start()
  return observerService
}

/** IPC boundary for the independent observer window. */
export function registerSessionObserverHandlers(runtime: OrcaRuntimeService, store?: Store): void {
  ipcMain.removeHandler('sessionObserver:open')
  ipcMain.removeHandler('sessionObserver:requestSnapshot')
  ipcMain.removeHandler('sessionObserver:reanalyze')
  ipcMain.removeHandler('sessionObserver:updateManualStatus')
  ipcMain.removeHandler('sessionObserver:reveal')
  ipcMain.removeHandler('sessionObserver:close')

  const service = getObserverService(runtime, store)
  let snapshotGeneration = 0
  const publishSnapshot = (): void => {
    const target = getSessionObserverWindow()
    if (!target) {
      return
    }
    const generation = ++snapshotGeneration
    void service
      .snapshot()
      .then((snapshot) => {
        if (generation !== snapshotGeneration) {
          return
        }
        const current = getSessionObserverWindow()
        if (current && !current.webContents.isDestroyed()) {
          current.webContents.send('sessionObserver:snapshot', snapshot)
        }
      })
      .catch((error) => console.warn('[session-observer] could not build snapshot', error))
  }

  unsubscribeObserverChanges?.()
  unsubscribeObserverChanges = service.subscribe(publishSnapshot)

  ipcMain.handle('sessionObserver:open', (event): void => {
    if (!isTrustedUIRenderer(event.sender)) {
      return
    }
    createOrFocusSessionObserver()
  })

  ipcMain.handle('sessionObserver:requestSnapshot', (event): void => {
    if (!isSessionObserverRenderer(event.sender)) {
      return
    }
    publishSnapshot()
  })

  ipcMain.handle('sessionObserver:reanalyze', (event, sessionId: unknown): boolean => {
    if (!isSessionObserverRenderer(event.sender) || !isValidSessionId(sessionId)) {
      return false
    }
    return service.reanalyze(sessionId)
  })

  ipcMain.handle(
    'sessionObserver:updateManualStatus',
    async (event, sessionId: unknown, manualStatusOverride: unknown): Promise<boolean> => {
      if (
        !isSessionObserverRenderer(event.sender) ||
        !isValidSessionId(sessionId) ||
        !isValidManualStatusOverride(manualStatusOverride)
      ) {
        return false
      }
      return service.updateManualStatus(sessionId, manualStatusOverride)
    }
  )

  ipcMain.handle('sessionObserver:reveal', (event, args: unknown): boolean => {
    if (!isSessionObserverRenderer(event.sender) || !isValidRevealArgs(args)) {
      return false
    }
    const mainWindow = getTrustedUIRendererWindow()
    if (!mainWindow) {
      return false
    }
    safelyRevealWindow(mainWindow)
    mainWindow.webContents.send('ui:revealSessionObserver', args)
    if (!isBackgroundLaunch()) {
      try {
        app.focus({ steal: true })
      } catch {
        // Best-effort; the per-window focus above may still bring it forward.
      }
    }
    return true
  })

  ipcMain.handle('sessionObserver:close', (event, args: unknown): boolean => {
    if (!isSessionObserverRenderer(event.sender) || !isValidCloseArgs(args)) {
      return false
    }
    const mainWindow = getTrustedUIRendererWindow()
    if (!mainWindow) {
      return false
    }
    safelyRevealWindow(mainWindow)
    mainWindow.webContents.send('ui:closeSessionObserver', args)
    if (!isBackgroundLaunch()) {
      try {
        app.focus({ steal: true })
      } catch {
        // Best-effort; the per-window focus above may still bring it forward.
      }
    }
    return true
  })
}
