import { app, ipcMain } from 'electron'
import { join } from 'node:path'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { agentHookServer } from '../agent-hooks/server'
import { SessionObserverService } from '../session-observer/session-observer-service'
import { JsonSessionObserverStateStore } from '../session-observer/session-observer-state-store'
import {
  createOrFocusSessionObserver,
  getSessionObserverWindow,
  isSessionObserverRenderer
} from '../window/session-observer-window'
import { isTrustedUIRenderer } from './ui'

const SESSION_ID_MAX_LENGTH = 4_096

let observerService: SessionObserverService | null = null
let unsubscribeObserverChanges: (() => void) | null = null

function isValidSessionId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= SESSION_ID_MAX_LENGTH
}

function getObserverService(runtime: OrcaRuntimeService): SessionObserverService {
  if (observerService) {
    return observerService
  }
  observerService = new SessionObserverService({
    runtime,
    hookServer: agentHookServer,
    storage: new JsonSessionObserverStateStore(
      join(app.getPath('userData'), 'orcb-session-observer.json')
    )
  })
  observerService.start()
  return observerService
}

/** IPC boundary for the independent observer window. */
export function registerSessionObserverHandlers(runtime: OrcaRuntimeService): void {
  ipcMain.removeHandler('sessionObserver:open')
  ipcMain.removeHandler('sessionObserver:requestSnapshot')
  ipcMain.removeHandler('sessionObserver:reanalyze')

  const service = getObserverService(runtime)
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
}
