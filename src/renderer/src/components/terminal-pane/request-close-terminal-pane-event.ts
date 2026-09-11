import type { RequestCloseTerminalPaneDetail } from '@/constants/terminal'

type RequestCloseTerminalPaneEventDeps = {
  tabId: string
  manager: {
    getNumericIdForLeaf: (leafId: string) => number | null
  } | null
  getPtyIdForPane: (paneId: number) => string | null | undefined
  handleRequestClosePane: (paneId: number) => void
}

export function handleRequestCloseTerminalPaneDetail(
  detail: RequestCloseTerminalPaneDetail | undefined,
  deps: RequestCloseTerminalPaneEventDeps
): void {
  if (!detail || detail.handled || detail.tabId !== deps.tabId || !deps.manager) {
    return
  }
  const paneId = deps.manager.getNumericIdForLeaf(detail.leafId)
  if (paneId === null) {
    return
  }
  if (detail.expectedPtyId && deps.getPtyIdForPane(paneId) !== detail.expectedPtyId) {
    return
  }
  detail.handled = true
  deps.handleRequestClosePane(paneId)
}
