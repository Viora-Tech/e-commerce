'use client'

import { ChevronLeftIcon, ChevronRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { useEditorView } from '@/lib/customize-view'

type PanelToggleProps = { side: 'left' | 'right' }

/**
 * A small tab on the canvas edge that hides or shows the side panel next to it (remembered in
 * this browser, see `lib/customize-view.ts`). The chevron points where the panel will go.
 */
export default function PanelToggle({ side }: PanelToggleProps) {
  // Hooks
  const copy = useCopy(customizeContent.view)
  const view = useEditorView()

  // Render logic
  const open = side === 'left' ? view.left : view.right
  const label =
    side === 'left'
      ? open
        ? copy.hideLeft
        : copy.showLeft
      : open
        ? copy.hideRight
        : copy.showRight
  // Toward the panel to close it, away from it to open it.
  const pointsLeft = side === 'left' ? open : !open
  const Icon = pointsLeft ? ChevronLeftIcon : ChevronRight

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => (side === 'left' ? view.setLeft(!open) : view.setRight(!open))}
            aria-label={label}
            aria-expanded={open}
            className={cn(
              'absolute top-1/2 z-20 flex h-12 w-4 -translate-y-1/2 items-center justify-center border-y border-border bg-card text-muted-foreground shadow-card transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              side === 'left' ? 'left-0 rounded-r-md border-r' : 'right-0 rounded-l-md border-l',
            )}
          />
        }
      >
        <Icon aria-hidden weight="regular" className="size-3" />
      </TooltipTrigger>
      <TooltipContent side={side === 'left' ? 'right' : 'left'}>{label}</TooltipContent>
    </Tooltip>
  )
}
