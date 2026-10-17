import { describeDiscountValue } from '@commerce/core/discounts'
import OrderChip from '@/components/orders/order-chip'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { DiscountLifecycle, discountsContent } from '@/data/discounts'
import type { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'

export type DiscountRow = Awaited<ReturnType<typeof api.discounts.list>>['items'][number]

type Copy = typeof discountsContent

const SHORT_DAY = { day: 'numeric', month: 'short' } as const

/** Only a discount waiting to start is worth a coloured chip; everything else is quiet. */
function datesLabel(item: DiscountRow, copy: Copy, fmt: Formatters): string {
  const from = item.startsAt ? fmt.pattern(item.startsAt, SHORT_DAY) : null
  const to = item.endsAt ? fmt.pattern(item.endsAt, SHORT_DAY) : null
  if (from && to) return `${from} – ${to}`
  if (from) return copy.since(from)
  if (to) return copy.until(to)
  return copy.ongoing
}

/** Columns of the discount list (Figma "Marketing / Discounts"). */
export function discountColumns(copy: Copy, fmt: Formatters): ResourceColumnSpec<DiscountRow>[] {
  return [
    {
      id: 'title',
      title: copy.columns.title,
      sortValue: (d) => d.title,
      hideable: false,
      align: 'start',
      className: 'w-72 px-3 whitespace-normal',
      render: (d) => (
        <span className="flex flex-col text-left">
          <span className="text-ink-strong">{d.title}</span>
          <span className="text-caption text-muted-foreground">
            {d.code ? <span className="uppercase">{d.code}</span> : copy.kind.automatic}
          </span>
        </span>
      ),
    },
    { id: 'method', title: copy.columns.method, render: (d) => describeDiscountValue(d) },
    { id: 'kind', title: copy.columns.kind, render: (d) => copy.kind[d.kind] },
    {
      id: 'used',
      title: copy.columns.used,
      align: 'end',
      sortValue: (d) => d.usedCount,
      render: (d) => <span className="tabular-nums">{copy.usedOf(d.usedCount, d.usageLimit)}</span>,
    },
    {
      id: 'dates',
      title: copy.columns.dates,
      sortValue: (d) => (d.startsAt ? new Date(d.startsAt).getTime() : 0),
      render: (d) => <span className="tabular-nums">{datesLabel(d, copy, fmt)}</span>,
    },
    {
      id: 'status',
      title: copy.columns.status,
      align: 'center',
      render: (d) => <OrderChip kind="discount" value={d.lifecycle} />,
    },
  ]
}
