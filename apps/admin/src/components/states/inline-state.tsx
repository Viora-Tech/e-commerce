'use client'

import { CircleAlert, Inbox, WifiOff } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import type { ReactNode } from 'react'
import { statesContent } from '@/data/states'
import { useCopy } from '@/hooks/use-copy'

type InlineStateProps = {
  kind: 'error' | 'offline' | 'empty'
  heading?: string
  body?: string
  onRetry?: () => void
  action?: ReactNode
  className?: string
}

const ICON = { error: CircleAlert, offline: WifiOff, empty: Inbox } as const

/**
 * Small state for one card or section (Figma "State · Inline"): icon, a line of words, and a
 * plain button. Use it where a whole-page state would be too much.
 */
export default function InlineState({
  kind,
  heading,
  body,
  onRetry,
  action,
  className,
}: InlineStateProps) {
  // Hooks
  const copy = useCopy(statesContent)

  // Render logic
  const Icon = ICON[kind]
  const words = copy[kind]
  const retry = kind === 'empty' ? null : copy[kind].retry

  return (
    <div
      role={kind === 'error' ? 'alert' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg bg-muted/60 px-4 py-3 text-body',
        className,
      )}
    >
      <Icon
        className={cn(
          'size-5 shrink-0',
          kind === 'error' ? 'text-danger' : 'text-muted-foreground',
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{heading ?? words.heading}</p>
        <p className="text-caption text-muted-foreground">{body ?? words.body}</p>
      </div>
      {action ??
        (onRetry && retry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {retry}
          </Button>
        ) : null)}
    </div>
  )
}
