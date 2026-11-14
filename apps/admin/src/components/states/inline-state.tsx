'use client'

import { CircleAlert, Lock, RotateCcw, WifiOff } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { ReactNode } from 'react'
import EmptyState from '@/components/layout/empty-state'
import { statesContent } from '@/data/states'
import { useCopy } from '@/hooks/use-copy'

type InlineStateProps = {
  kind: 'error' | 'offline' | 'no-access'
  heading?: string
  body?: string
  onRetry?: () => void
  action?: ReactNode
  className?: string
}

const ICON = { error: CircleAlert, offline: WifiOff, 'no-access': Lock } as const

/**
 * Small state for one card or section (Figma "State · Inline"): icon, a line of words, and a
 * plain button. Use it where a whole-page state would be too much. Empty cards use EmptyState
 * `variant="inline"`.
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
  const words = kind === 'no-access' ? copy.noAccess : copy[kind]
  const retry = kind === 'error' || kind === 'offline' ? copy[kind].retry : null

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
            <RotateCcw aria-hidden="true" />
            {retry}
          </Button>
        ) : null)
      }
    />
  )
}
