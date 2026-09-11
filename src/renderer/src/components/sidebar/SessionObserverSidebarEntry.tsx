import { MessagesSquare } from 'lucide-react'
import { translate } from '@/i18n/i18n'

/** A persistent, named entry for the independent session observer window. */
export function SessionObserverSidebarEntry(): React.JSX.Element {
  const label = translate('sessionObserver.sidebar.label', 'Session Management')

  return (
    <button
      type="button"
      data-session-observer-entry=""
      onClick={() => {
        void window.api.sessionObserver.open()
      }}
      aria-label={label}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight text-worktree-sidebar-foreground/60 transition-colors hover:bg-worktree-sidebar-foreground/8"
    >
      <MessagesSquare
        className="size-4 shrink-0 text-worktree-sidebar-foreground/30"
        strokeWidth={1.75}
      />
      <span className="flex-1">{label}</span>
    </button>
  )
}
