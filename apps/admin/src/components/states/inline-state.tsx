'use client'

import { CircleAlert, Inbox, WifiOff } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { ReactNode } from 'react'
import EmptyState from '@/components/layout/empty-state'
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
  const words = copy[kind]
  const retry = kind === 'empty' ? null : copy[kind].retry

  return (
    <EmptyState
      variant="inline"
      icon={ICON[kind]}
      tone={kind === 'error' ? 'danger' : 'neutral'}
      heading={heading ?? words.heading}
      body={body ?? words.body}
      className={className}
      action={
        action ??
        (onRetry && retry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {retry}
          </Button>
        ) : null)
      }
    />
  )
}
