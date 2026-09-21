import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@commerce/ui/shadcn/empty'
import { Inbox, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type EmptyStateProps = {
  heading: string
  body?: string
  icon?: LucideIcon
  action?: ReactNode
}

/** Centered empty state: 40px icon in a soft circle, card-title heading, one action. */
export function EmptyState({ heading, body, icon: Icon = Inbox, action }: EmptyStateProps) {
  return (
    <Empty className="gap-4 py-10">
      <EmptyHeader className="gap-2">
        <EmptyMedia
          variant="icon"
          className="mb-2 size-10 rounded-full bg-primary-soft text-primary [&_svg]:size-5"
        >
          <Icon strokeWidth={1.8} />
        </EmptyMedia>
        <EmptyTitle className="text-card-title">{heading}</EmptyTitle>
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
