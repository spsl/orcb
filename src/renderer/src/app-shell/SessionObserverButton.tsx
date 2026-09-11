import { Eye } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Global entry point for the independent session observer window.
 *
 * Keep this control in its own component so each titlebar layout can expose the
 * same action without duplicating the IPC/tooltip implementation.
 */
export function SessionObserverButton({
  className = 'titlebar-icon-button'
}: {
  className?: string
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={className}
          onClick={() => {
            void window.api.sessionObserver.open()
          }}
          aria-label="打开会话分析"
          title="打开会话分析"
        >
          <Eye size={14} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        打开会话分析
      </TooltipContent>
    </Tooltip>
  )
}
