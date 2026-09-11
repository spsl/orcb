import { ipcRenderer } from 'electron'
import type {
  SessionObserverManualStatusOverride,
  SessionObserverSnapshot
} from '../../shared/session-observer'
import type { PreloadApi } from '../api-types'

export const sessionObserverApi = {
  open: (): Promise<void> => ipcRenderer.invoke('sessionObserver:open'),
  requestSnapshot: (): Promise<void> => ipcRenderer.invoke('sessionObserver:requestSnapshot'),
  reanalyze: (sessionId: string): Promise<boolean> =>
    ipcRenderer.invoke('sessionObserver:reanalyze', sessionId),
  updateManualStatus: (
    sessionId: string,
    manualStatusOverride: SessionObserverManualStatusOverride
  ): Promise<boolean> =>
    ipcRenderer.invoke('sessionObserver:updateManualStatus', sessionId, manualStatusOverride),
  onSnapshot: (callback: (snapshot: SessionObserverSnapshot) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: SessionObserverSnapshot): void =>
      callback(snapshot)
    ipcRenderer.on('sessionObserver:snapshot', listener)
    return () => ipcRenderer.removeListener('sessionObserver:snapshot', listener)
  }
} satisfies PreloadApi['sessionObserver']
