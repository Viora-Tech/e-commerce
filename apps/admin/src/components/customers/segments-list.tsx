'use client'

import { ArrowRight, Plus, Users } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import EmptyState from '@/components/layout/empty-state'
import RelativeTime from '@/components/layout/relative-time'
import { segmentsContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Segment = Awaited<ReturnType<typeof api.customers.segments>>[number]

type SegmentsListProps = { segments: Segment[] }

/* Segment, how many customers match right now, last change, open arrow. */
const ROW = 'grid grid-cols-[minmax(0,1fr)_8rem_9rem_1.5rem] items-center gap-x-3 px-4 md:px-6'

/** Saved filters in a table card, each with the count it matches right now. */
export default function SegmentsList({ segments }: SegmentsListProps) {
  // Hooks
  const copy = useCopy(segmentsContent)

  // Early returns
  if (segments.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Users}
          heading={copy.empty.heading}
          body={copy.empty.body}
          action={
            <Button render={<Link href={routes.customers.newSegment()} />} nativeButton={false}>
              <Plus />
              {copy.create}
            </Button>
          }
        />
      </Card>
    )
  }

  // Render logic
  return (
    <Card gap="none" inset="y-none">
      <div
        className={cn(
          ROW,
          'h-10 border-b border-line text-caption font-medium text-muted-foreground',
        )}
      >
        <span>{copy.columns.name}</span>
        <span className="text-right">{copy.columns.customers}</span>
        <span>{copy.columns.updated}</span>
        <span />
      </div>
      {segments.map((s) => (
        <Link
          key={s.id}
          href={routes.customers.segment(s.id)}
          className={cn(
            ROW,
            'group/row h-12 border-b border-line text-body text-foreground transition-colors last:border-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          )}
        >
          <span className="truncate font-medium">{s.name}</span>
          <span className="text-right tabular-nums">
            {copy.builder.previewCount(s.customerCount)}
          </span>
          <RelativeTime value={s.updatedAt} className="text-muted-foreground" />
          <ArrowRight
            className="size-4 text-muted-foreground opacity-40 transition-opacity group-hover/row:opacity-100"
            aria-hidden
          />
        </Link>
      ))}
    </Card>
  )
}
