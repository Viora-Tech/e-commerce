'use client'

import { Plus, Users } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import EmptyState from '@/components/layout/empty-state'
import RelativeTime from '@/components/layout/relative-time'
import { segmentsContent } from '@/data/customers'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import SegmentRowMenu from './segment-row-menu'

type Segment = Awaited<ReturnType<typeof api.customers.segments>>[number]

type SegmentsListProps = { segments: Segment[] }
type SegmentCopy = typeof segmentsContent

/** "Order count is at least 2 · State is MH": the saved conditions in words (spend is paise). */
function rulesLine(copy: SegmentCopy, money: (paise: number) => string, s: Segment): string {
  const parts = s.rules.conditions.map((c) => {
    const value =
      c.field === 'marketing'
        ? (copy.marketingValues[c.value] ?? c.value)
        : c.field === 'spend'
          ? money(Number(c.value))
          : c.value
    return `${copy.fields[c.field] ?? c.field} ${copy.ops[c.op] ?? c.op} ${value}`
  })
  return parts.join(s.rules.match === 'any' ? copy.orJoin : ' · ')
}

/* Segment, how many customers match right now, last change, ⋯ menu. */
const ROW = 'grid grid-cols-[minmax(0,1fr)_8rem_9rem_1.75rem] items-center gap-x-3 px-4 md:px-6'

/** Saved filters in a table card, each with the count it matches right now. */
export default function SegmentsList({ segments }: SegmentsListProps) {
  // Hooks
  const copy = useCopy(segmentsContent)
  const fmt = useFormat()

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
        <div
          key={s.id}
          className={cn(
            ROW,
            'group/row relative h-15 border-b border-line text-body text-foreground transition-colors last:border-0 hover:bg-muted/50',
          )}
        >
          {/* The whole row opens the segment; the ⋯ menu sits above this link. */}
          <Link
            href={routes.customers.segment(s.id)}
            aria-label={s.name}
            className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-ink-strong">{s.name}</span>
            {s.rules.conditions.length > 0 ? (
              <span className="truncate text-caption text-muted-foreground">
                {rulesLine(copy, fmt.money, s)}
              </span>
            ) : null}
          </span>
          <span className="text-right tabular-nums">
            {copy.builder.previewCount(s.customerCount)}
          </span>
          <RelativeTime value={s.updatedAt} className="text-muted-foreground" />
          <span className="relative flex justify-end">
            <SegmentRowMenu id={s.id} />
          </span>
        </div>
      ))}
    </Card>
  )
}
