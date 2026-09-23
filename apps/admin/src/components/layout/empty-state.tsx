import { Inbox, type LucideIcon } from '@commerce/ui/icons'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@commerce/ui/shadcn/empty'
import type { ReactNode } from 'react'

type EmptyStateProps = {
  heading: string
  body?: string
  icon?: LucideIcon
  action?: ReactNode
}

/** Centered empty state: 40px icon on a neutral tile, card-title heading, one action. */
export default function EmptyState({ heading, body, icon: Icon = Inbox, action }: EmptyStateProps) {
  return (
    <Empty className="gap-4 py-12">
      <EmptyHeader className="gap-2">
        <EmptyMedia
          variant="icon"
          className="mb-2 size-10 rounded-lg border border-border bg-muted text-muted-foreground [&_svg]:size-5"
        >
          <Icon strokeWidth={1.8} />
        </EmptyMedia>
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
