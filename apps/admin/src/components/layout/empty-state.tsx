import { Inbox, type LucideIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@commerce/ui/shadcn/empty'
import type { ReactNode } from 'react'
import IconBadge from '@/components/layout/icon-badge'

type EmptyStateProps = {
  /**
   * `section`: centered inside a card that is already there. `page`: its own card, for a whole
   * page or list. `inline`: a small row for one card or section. `dashed` and `plain`: a line of
   * words only (no icon, heading or action), with or without a dashed border.
   */
  variant?: 'page' | 'section' | 'inline' | 'dashed' | 'plain'
  /** Vertical room of `dashed` and `plain`. */
  size?: 'sm' | 'md' | 'lg'
  icon?: LucideIcon
  /** `danger` tints the icon red and announces the state as an alert. */
  tone?: 'neutral' | 'danger'
  heading?: string
  body?: string
  action?: ReactNode
  className?: string
}

const SIZE = { sm: 'py-6', md: 'py-8', lg: 'py-10' } as const

/** The one "nothing here" state: pick a variant for how much room it has. */
export default function EmptyState({
  variant = 'section',
  size = 'md',
  icon: Icon = Inbox,
  tone,
  heading,
  body,
  action,
  className,
}: EmptyStateProps) {
  // Early returns
  if (variant === 'plain' || variant === 'dashed') {
    return (
      <p
        className={cn(
          'text-center text-body text-muted-foreground',
          variant === 'dashed' && 'rounded-lg border border-line border-dashed px-4',
          SIZE[size],
          className,
        )}
      >
        {body}
      </p>
    )
  }

  // Render logic
  const role = tone === 'danger' ? 'alert' : undefined

  if (variant === 'page') {
    return (
      <div
        role={role}
        className={cn(
          'flex flex-col items-center gap-3 rounded-xl surface-card px-6 py-12 text-center',
          className,
        )}
      >
        <IconBadge icon={Icon} tone={tone ?? 'neutral'} size="md" />
        {heading ? <h2 className="text-card-title text-ink-strong">{heading}</h2> : null}
        {body ? <p className="max-w-md text-body text-muted-foreground">{body}</p> : null}
        {action ? <div className="mt-1 flex items-center gap-2">{action}</div> : null}
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <div
        role={role}
        className={cn(
          'flex items-center gap-3 rounded-lg bg-muted/60 px-4 py-3 text-body',
          className,
        )}
      >
        <Icon
          className={cn(
            'size-5 shrink-0',
            tone === 'danger' ? 'text-danger' : 'text-muted-foreground',
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          {heading ? <p className="font-medium text-foreground">{heading}</p> : null}
          {body ? <p className="text-caption text-muted-foreground">{body}</p> : null}
        </div>
        {action}
      </div>
    )
  }

  return (
    <Empty role={role} className={cn('gap-4 py-12', className)}>
      <EmptyHeader className="gap-2">
        <IconBadge icon={Icon} tone={tone} size="md" className="mb-2" />
        <EmptyTitle className="text-card-title text-ink-strong">{heading}</EmptyTitle>
        {body ? (
          <EmptyDescription className="max-w-md text-body text-muted-foreground">
            {body}
          </EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}
