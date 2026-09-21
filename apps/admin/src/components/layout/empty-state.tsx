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

/** Centered empty state used inside cards and tables. */
export function EmptyState({ heading, body, icon: Icon = Inbox, action }: EmptyStateProps) {
  return (
    <Empty className="py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{heading}</EmptyTitle>
        {body ? <EmptyDescription>{body}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}
