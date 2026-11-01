import type { RolloutHold } from '@commerce/core'
import { describeDiscountValue } from '@commerce/core/discounts'
import OrderChip from '@/components/orders/order-chip'
import RolloutHoldChip from '@/components/rollouts/rollout-hold-chip'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { discountsContent } from '@/data/discounts'
import type { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'
import { combinationsLabel, discountListSummary, eligibilityLabel } from './discount-list-summary'

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

/** Columns the list starts with hidden; the View menu turns them on. */
export const DISCOUNT_HIDDEN_COLUMNS = ['eligibility', 'combinations']

/** Columns of the discount list (Figma "Marketing / Discounts"). */
export function discountColumns(
  copy: Copy,
  fmt: Formatters,
  holds: Record<string, RolloutHold> = {},
): ResourceColumnSpec<DiscountRow>[] {
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
          <span className="line-clamp-2 text-caption text-muted-foreground">
            {discountListSummary(d, copy, fmt.money)}
          </span>
          {holds[d.id] ? (
            <span className="mt-1">
              <RolloutHoldChip hold={holds[d.id]} />
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'method',
      title: copy.columns.method,
      // A long value ("₹6998 to ₹11498 off each item") wraps in its column instead of running
      // over Type (#996).
      render: (d) => (
        <span className="line-clamp-2 block max-w-48 whitespace-normal">
          {d.type === 'combo' ? copy.comboCount(d.combos?.length ?? 0) : describeDiscountValue(d)}
        </span>
      ),
    },
    { id: 'kind', title: copy.columns.kind, render: (d) => copy.kind[d.kind] },
    {
      id: 'used',
      title: copy.columns.used,
      align: 'end',
      sortValue: (d) => d.usedCount,
      render: (d) => <span className="tabular-nums">{copy.usedOf(d.usedCount, d.usageLimit)}</span>,
    },
    {
      id: 'revenue',
      title: copy.columns.revenue,
      align: 'end',
      sortValue: (d) => d.usage.revenuePaise,
      render: (d) => <span className="tabular-nums">{fmt.money(d.usage.revenuePaise)}</span>,
    },
    {
      id: 'given',
      title: copy.columns.given,
      align: 'end',
      sortValue: (d) => d.usage.amountPaise,
      render: (d) => <span className="tabular-nums">{fmt.money(d.usage.amountPaise)}</span>,
    },
    {
      id: 'lastUsed',
      title: copy.columns.lastUsed,
      sortValue: (d) => (d.usage.lastUsedAt ? new Date(d.usage.lastUsedAt).getTime() : 0),
      render: (d) => (
        <span className="tabular-nums text-muted-foreground">
          {d.usage.lastUsedAt ? fmt.date(d.usage.lastUsedAt) : copy.neverUsed}
        </span>
      ),
    },
    {
      id: 'dates',
      title: copy.columns.dates,
      sortValue: (d) => (d.startsAt ? new Date(d.startsAt).getTime() : 0),
      render: (d) => <span className="tabular-nums">{datesLabel(d, copy, fmt)}</span>,
    },
    {
      id: 'eligibility',
      title: copy.columns.eligibility,
      render: (d) => eligibilityLabel(d, copy),
    },
    {
      id: 'combinations',
      title: copy.columns.combinations,
      render: (d) => (
        <span className="line-clamp-2 block max-w-48 whitespace-normal">
          {combinationsLabel(d, copy)}
        </span>
      ),
    },
    {
      id: 'status',
      title: copy.columns.status,
      align: 'center',
      render: (d) => <OrderChip kind="discount" value={d.lifecycle} />,
    },
  ]
}
