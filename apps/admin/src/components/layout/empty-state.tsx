import { Inbox, type LucideIcon } from '@commerce/ui/icons'
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
  heading: string
  body?: string
  icon?: LucideIcon
  action?: ReactNode
}

/** Centered empty state: 40px icon on a soft-tinted tile, card-title heading, one action. */
export default function EmptyState({ heading, body, icon: Icon = Inbox, action }: EmptyStateProps) {
  return (
    <Empty className="gap-4 py-12">
      <EmptyHeader className="gap-2">
        <IconBadge icon={Icon} size="md" className="mb-2" />
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
