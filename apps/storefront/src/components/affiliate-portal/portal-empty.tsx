import type { IconComponent } from '@commerce/ui/icons'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@commerce/ui/shadcn/empty'
import type { ReactNode } from 'react'

type PortalEmptyProps = {
  icon: IconComponent
  title: string
  description: string
  /** One next step (a button or link), under the text. */
  action?: ReactNode
  className?: string | undefined
}

/**
 * shadcn's Empty block for a page or table with nothing in it yet: an icon tile, a title, one
 * line on what will show here, and the next step.
 */
export default function PortalEmpty({
  icon: Icon,
  title,
  description,
  action,
  className,
}: PortalEmptyProps) {
  // Render logic
  return (
    <Empty className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}
