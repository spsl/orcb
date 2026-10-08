import { useEffect, type RefObject } from 'react'
import type { Terminal } from '@xterm/xterm'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { EffectiveMacOptionAsAlt } from '@/lib/keyboard-layout/detect-option-as-alt'
import { buildPreviewAppearanceOptions } from './preview-terminal-options'
import { syncPreviewTerminalLigatures } from './preview-terminal-ligatures'

/** Apply appearance and input-source changes without reconnecting the PTY. */
export function usePreviewTerminalAppearance(
  terminalRef: RefObject<Terminal | null>,
  settings: GlobalSettings | null,
  macOptionAsAlt: EffectiveMacOptionAsAlt
): void {
  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) {
      return
    }
    Object.assign(
      terminal.options,
      buildPreviewAppearanceOptions(settings, macOptionAsAlt === 'true')
    )
    syncPreviewTerminalLigatures(terminal, settings)
  }, [terminalRef, settings, macOptionAsAlt])
}
