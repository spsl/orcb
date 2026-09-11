import { ipcRenderer } from 'electron'
import type {
  SessionObserverManualStatusOverride,
  SessionObserverRevealArgs,
  SessionObserverCloseArgs,
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
  reveal: (args) => ipcRenderer.invoke('sessionObserver:reveal', args),
  close: (args: SessionObserverCloseArgs): Promise<boolean> =>
    ipcRenderer.invoke('sessionObserver:close', args),
  onReveal: (callback: (args: SessionObserverRevealArgs) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, args: SessionObserverRevealArgs): void =>
      callback(args)
    ipcRenderer.on('ui:revealSessionObserver', listener)
    return () => ipcRenderer.removeListener('ui:revealSessionObserver', listener)
  },
  onClose: (callback: (args: SessionObserverCloseArgs) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, args: SessionObserverCloseArgs): void =>
      callback(args)
    ipcRenderer.on('ui:closeSessionObserver', listener)
    return () => ipcRenderer.removeListener('ui:closeSessionObserver', listener)
  },
  onSnapshot: (callback: (snapshot: SessionObserverSnapshot) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: SessionObserverSnapshot): void =>
      callback(snapshot)
    ipcRenderer.on('sessionObserver:snapshot', listener)
    return () => ipcRenderer.removeListener('sessionObserver:snapshot', listener)
  }
} satisfies PreloadApi['sessionObserver']
