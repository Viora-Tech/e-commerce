'use client'

import { CircleCheck, RotateCcw } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import { inboxConversationsContent } from '@/data/inbox-conversations'
import { useCopy } from '@/hooks/use-copy'

type CloseButtonProps = {
  status: 'open' | 'closed'
  onClick: () => void
  className?: string
}

/**
 * Shopify Inbox's ✓-in-a-circle: closes an open conversation, or reopens a closed one. Used on
 * the thread header and on a list row (shown on hover or keyboard focus). No motion of its own.
 */
export default function CloseButton({ status, onClick, className }: CloseButtonProps) {
  // Hooks
  const copy = useCopy(inboxConversationsContent)

  // Render logic
  const label = status === 'open' ? copy.thread.markClosed : copy.thread.reopen
  const Icon = status === 'open' ? CircleCheck : RotateCcw

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-background text-muted-foreground hover:bg-accent hover:text-ink-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              className,
            )}
          />
        }
      >
        <Icon className="size-4.5" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
