import type { LucideIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import EmptyState from './empty-state'
import PageBody from './page-body'

export type SectionEmptyContent = {
  heading: string
  body: string
  /** Optional link to the nearest thing that works today. */
  action?: { label: string; href: string }
}

type SectionEmptyProps = SectionEmptyContent & { icon: LucideIcon }

/** Whole-page empty state for a section that has no records yet. */
export default function SectionEmpty({ heading, body, action, icon }: SectionEmptyProps) {
  return (
    <PageBody>
      <Card inset="y-10">
        <EmptyState
          heading={heading}
          body={body}
          icon={icon}
          action={
            action ? (
              <Button nativeButton={false} variant="outline" render={<Link href={action.href} />}>
                {action.label}
              </Button>
            ) : undefined
          }
        />
      </Card>
    </PageBody>
  )
}
