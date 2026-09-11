import './assets/main.css'

import { StrictMode, useEffect } from 'react'
import { I18nProvider } from './i18n/I18nProvider'
import { applyDocumentTheme } from './lib/document-theme'
import { buildAppFontFamily } from './lib/app-font-family'
import { getOrCreateRendererRoot } from './lib/react-renderer-root'
import { RecoverableRenderErrorBoundary } from './components/error-boundaries/RecoverableRenderErrorBoundary'
import { SessionObserverRoot } from './components/session-observer/SessionObserverRoot'
import { useAppStore } from './store'
import type { GlobalSettings } from '../../shared/global-settings-types'

function applyObserverAppearance(settings: GlobalSettings | null): void {
  applyDocumentTheme(settings?.theme ?? 'system', { disableTransitions: false })
  document.documentElement.style.setProperty(
    '--app-font-family',
    buildAppFontFamily(settings?.appFontFamily)
  )
}

let startupSettings: GlobalSettings | null = null
try {
  startupSettings = window.api.settings.getSync()
} catch {
  // The async settings pull below keeps the observer usable during startup races.
}
if (startupSettings) {
  useAppStore.setState({ settings: startupSettings })
}
applyObserverAppearance(startupSettings)

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Session observer root element not found.')
}

function ObserverSettingsSync(): null {
  const settings = useAppStore((state) => state.settings)

  useEffect(() => {
    let disposed = false
    void useAppStore.getState().fetchKeybindings()
    const setSettings = (next: GlobalSettings): void => {
      if (!disposed) {
        useAppStore.setState({ settings: next })
      }
    }
    const unsubscribe = window.api.settings.onChanged((updates) => {
      const current = useAppStore.getState().settings
      if (current) {
        setSettings({ ...current, ...updates })
      }
    })
    void window.api.settings
      .get()
      .then(setSettings)
      .catch(() => undefined)
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    applyObserverAppearance(settings)
    if (settings?.theme !== 'system') {
      return
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (): void => applyDocumentTheme('system')
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [settings])

  return null
}

getOrCreateRendererRoot(rootElement, import.meta.hot?.data).render(
  <StrictMode>
    <I18nProvider>
      <ObserverSettingsSync />
      <RecoverableRenderErrorBoundary
        boundaryId="session-observer.root"
        surface="page"
        title="会话分析无法完成渲染"
        description="请重试，或关闭后重新打开会话分析窗口。"
      >
        <SessionObserverRoot />
      </RecoverableRenderErrorBoundary>
    </I18nProvider>
  </StrictMode>
)
