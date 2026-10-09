'use client'

import { CircleAlert, Compass, Inbox, Lock, Plus, WifiOff } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import type { ReactNode } from 'react'
import IconBadge from '@/components/layout/icon-badge'
import { statesContent } from '@/data/states'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type PageStateProps = {
  kind: 'error' | 'offline' | 'no-access' | 'not-found' | 'empty'
  /** Retry (error, offline); renders the key button. */
  onRetry?: () => void
  /** Replaces the default button: an empty state's "Add item", say. */
  action?: ReactNode
  /** Override the default words for this kind. */
  heading?: string
  body?: string
  /** Show "Contact support" beside Retry (error only). */
  supportHref?: string
}

const ICON = {
  error: CircleAlert,
  offline: WifiOff,
  'no-access': Lock,
  'not-found': Compass,
  empty: Inbox,
} as const

/**
 * Full-card page state (Figma "State · Page"): an icon tile, a heading, one line, and one key
 * action. Error is the only one with a red tile; the rest are neutral.
 */
export default function PageState({
  kind,
  onRetry,
  action,
  heading,
  body,
  supportHref,
}: PageStateProps) {
  // Hooks
  const copy = useCopy(statesContent)

  // Render logic
  const words = {
    error: { heading: copy.error.heading, body: copy.error.body, cta: copy.error.retry },
    offline: { heading: copy.offline.heading, body: copy.offline.body, cta: copy.offline.retry },
    'no-access': {
      heading: copy.noAccess.heading,
      body: copy.noAccess.body,
      cta: copy.noAccess.request,
    },
    'not-found': {
      heading: copy.notFound.heading,
      body: copy.notFound.body,
      cta: copy.notFound.home,
    },
    empty: { heading: copy.empty.heading, body: copy.empty.body, cta: copy.empty.add },
  }[kind]
  const defaultAction =
    kind === 'not-found' ? (
      <Button render={<Link href={routes.home()} />} nativeButton={false}>
        {words.cta}
      </Button>
    ) : onRetry ? (
      <Button onClick={onRetry}>{words.cta}</Button>
    ) : kind === 'empty' ? (
      <Button>
        <Plus aria-hidden />
        {words.cta}
      </Button>
    ) : null

  return (
    <div
      role={kind === 'error' ? 'alert' : undefined}
      className="flex flex-col items-center gap-3 rounded-xl surface-card px-6 py-12 text-center"
    >
      <IconBadge icon={ICON[kind]} tone={kind === 'error' ? 'danger' : 'neutral'} size="md" />
      <h2 className="text-card-title text-ink-strong">{heading ?? words.heading}</h2>
      <p className="max-w-md text-body text-muted-foreground">{body ?? words.body}</p>
      <div className="mt-1 flex items-center gap-2">
        {action ?? defaultAction}
        {kind === 'error' && supportHref ? (
          <Button
            variant="ghost"
            render={<a href={supportHref} target="_blank" rel="noreferrer" />}
            nativeButton={false}
          >
            {copy.error.support}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
