'use client'

import { Plus, Users } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { TableCell } from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import EmptyState from '@/components/layout/empty-state'
import RelativeTime from '@/components/layout/relative-time'
import LinkRow from '@/components/table/link-row'
import RowActionsCell from '@/components/table/row-actions-cell'
import SimpleTable from '@/components/table/simple-table'
import { segmentsContent } from '@/data/customers'
import { tableContent } from '@/data/table'
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
        : c.field === 'business'
          ? (copy.businessValues[c.value] ?? c.value)
          : c.field === 'spend'
            ? money(Number(c.value))
            : c.value
    return `${copy.fields[c.field] ?? c.field} ${copy.ops[c.op] ?? c.op} ${value}`
  })
  return parts.join(s.rules.match === 'any' ? copy.orJoin : ' · ')
}

/** Saved filters in a table card, each with the count it matches right now. */
export default function SegmentsList({ segments }: SegmentsListProps) {
  // Hooks
  const copy = useCopy(segmentsContent)
  const fmt = useFormat()
  const tableCopy = useCopy(tableContent)

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
  // The list's table card, as ResourceTable draws it; the rows are SimpleTable's.
  return (
    <Card gap="none" inset="y-none" className="overflow-hidden">
      <SimpleTable
        label={copy.heading}
        columns={[
          { key: 'name', label: copy.columns.name },
          { key: 'customers', label: copy.columns.customers, align: 'end', className: 'w-32' },
          { key: 'updated', label: copy.columns.updated, className: 'w-36' },
          {
            key: 'actions',
            label: <span className="sr-only">{tableCopy.more}</span>,
            className: 'w-12',
          },
        ]}
      >
        {segments.map((s) => (
          <LinkRow key={s.id} href={routes.customers.segment(s.id)}>
            <TableCell className="max-w-0">
              <span className="flex min-w-0 flex-col">
                <Link
                  href={routes.customers.segment(s.id)}
                  className="truncate text-ink-strong hover:underline"
                >
                  {s.name}
                </Link>
                {s.rules.conditions.length > 0 ? (
                  <span className="truncate text-caption text-muted-foreground">
                    {rulesLine(copy, fmt.money, s)}
                  </span>
                ) : null}
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {copy.builder.previewCount(s.customerCount)}
            </TableCell>
            <TableCell>
              <RelativeTime value={s.updatedAt} className="text-muted-foreground" />
            </TableCell>
            <TableCell>
              <RowActionsCell>
                <SegmentRowMenu id={s.id} />
              </RowActionsCell>
            </TableCell>
          </LinkRow>
        ))}
      </SimpleTable>
    </Card>
  )
}
