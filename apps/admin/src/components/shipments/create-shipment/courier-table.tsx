'use client'

import type { CourierRateRow } from '@commerce/core'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Fragment } from 'react'
import StatusChip from '@/components/layout/status-chip'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { courierInitials } from './courier-groups'
import { courierLogoSrc } from './courier-logo'

type CourierTableProps = {
  rows: readonly CourierRateRow[]
  pick: string
  onPick: (optionKey: string) => void
  /** Books that courier at once. Absent while the prices answer an older package. */
  onShipNow?: ((optionKey: string) => void) | undefined
  /** The option whose Ship now is booking. */
  shippingKey: string | null
  /** The insurance toggle is on: the charge line names it. */
  insured: boolean
}

const SHORT_DATE = { weekday: 'short', day: 'numeric', month: 'short' } as const

/** The breakdown's columns, in the courier's own order when it itemised one (Figma 898:7790). */
const BREAKDOWN_ORDER = ['freight', 'fuel', 'cod', 'insurance', 'rto', 'other', 'gst'] as const

const kg = (grams: number) => Math.round(grams / 10) / 100

/**
 * The Select courier drawer's table (Figma 898:7790): logo with its badge under it, name and
 * how it is booked, delivery date and days, charged weight, charges, and Ship now. The picked
 * row opens its price breakdown under it. A courier that cannot take the parcel is dimmed and
 * says why; the rest stay bookable.
 */
export default function CourierTable({
  rows,
  pick,
  onPick,
  onShipNow,
  shippingKey,
  insured,
}: CourierTableProps) {
  // Hooks
  const copy = useCopy(createShipmentContent)
  const fmt = useFormat()

  // Render logic
  const d = copy.drawer
  const c = copy.courier

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] border-collapse text-body">
        <thead>
          <tr className="bg-muted/50 text-left text-caption uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">{d.columns.courier}</th>
            <th className="px-4 py-2.5 font-medium">{d.columns.delivery}</th>
            <th className="px-4 py-2.5 font-medium">{d.columns.weight}</th>
            <th className="px-4 py-2.5 font-medium">{d.columns.charges}</th>
            <th className="px-4 py-2.5">
              <span className="sr-only">{d.shipNow}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const blocked = row.problem !== null
            const picked = pick === row.optionKey
            const logo = courierLogoSrc(row.providerLabel)
            const date = row.deliveryBy ? fmt.pattern(row.deliveryBy, SHORT_DATE) : null
            const badge = row.badges.includes('recommended')
              ? { label: c.recommended, tone: 'info' as const }
              : row.badges.includes('cheapest')
                ? { label: c.cheapest, tone: 'success' as const }
                : row.badges.includes('fastest')
                  ? { label: c.fastest, tone: 'violet' as const }
                  : null
            const via = row.providerName && !row.providerLabel.includes(row.providerName)
            const sub = blocked
              ? `${c.problem[row.problem ?? 'unreachable']}${row.problemDetail && row.problem !== 'no_cod' ? ` (${row.problemDetail})` : ''}`
              : [
                  via ? d.via(row.providerName) : null,
                  row.codAvailable === null ? null : row.codAvailable ? c.codYes : c.codNo,
                ]
                  .filter(Boolean)
                  .join(' · ')
            const charges = [...row.charges].sort(
              (a, b) => BREAKDOWN_ORDER.indexOf(a.kind) - BREAKDOWN_ORDER.indexOf(b.kind),
            )
            return (
              <Fragment key={row.optionKey}>
                <tr
                  aria-selected={picked}
                  onClick={blocked ? undefined : () => onPick(row.optionKey)}
                  className={cn(
                    'border-t border-hairline align-middle',
                    blocked ? 'opacity-50' : 'cursor-pointer hover:bg-row-hover',
                    picked && 'bg-primary-soft',
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex w-16 shrink-0 flex-col items-start gap-1.5">
                        {logo ? (
                          <span
                            aria-hidden
                            className={cn(
                              'flex h-8 w-14 items-center justify-center overflow-hidden rounded-md',
                              logo.light && 'bg-white px-1',
                            )}
                          >
                            {/* biome-ignore lint/performance/noImgElement: a small static logo from /public. */}
                            <img
                              src={logo.src}
                              alt=""
                              className="max-h-7 max-w-full object-contain"
                            />
                          </span>
                        ) : (
                          <span
                            aria-hidden
                            className="flex size-8 items-center justify-center rounded-md border border-border bg-muted text-caption font-semibold text-ink-strong"
                          >
                            {courierInitials(row.providerLabel)}
                          </span>
                        )}
                        {badge ? <StatusChip tone={badge.tone}>{badge.label}</StatusChip> : null}
                      </div>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-medium text-ink-strong">
                          {row.providerLabel}
                          {row.chosenAtCheckout ? (
                            <StatusChip tone="attention" className="ml-2">
                              {c.chosenAtCheckout}
                            </StatusChip>
                          ) : null}
                        </span>
                        {sub ? (
                          <span
                            className={cn(
                              'text-caption',
                              blocked ? 'text-danger' : 'text-muted-foreground',
                            )}
                          >
                            {sub}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {blocked ? (
                      '—'
                    ) : (
                      <div className="flex flex-col">
                        <span className="text-ink-strong">{date ?? c.noDate}</span>
                        {row.maxTransitDays !== null ? (
                          <span className="text-caption text-muted-foreground">
                            {d.inDays(row.maxTransitDays)}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {blocked || row.chargeableWeightGrams === null
                      ? '—'
                      : `${fmt.number(kg(row.chargeableWeightGrams))} kg`}
                  </td>
                  <td className="px-4 py-3">
                    {blocked ? (
                      '—'
                    ) : row.pricePaise === null ? (
                      <span className="text-caption text-muted-foreground">{c.rateOnBooking}</span>
                    ) : (
                      <div className="flex flex-col">
                        <span className="text-lg font-semibold tabular-nums text-ink-strong">
                          {fmt.money(row.pricePaise)}
                        </span>
                        <span className="text-caption text-muted-foreground">
                          {insured ? d.inclGstInsurance : d.inclGst}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {onShipNow && !blocked ? (
                      <Button
                        size="sm"
                        variant={picked ? 'default' : 'outline'}
                        loading={shippingKey === row.optionKey}
                        disabled={shippingKey !== null}
                        onClick={(e) => {
                          e.stopPropagation()
                          onShipNow(row.optionKey)
                        }}
                      >
                        {d.shipNow}
                      </Button>
                    ) : null}
                  </td>
                </tr>
                {picked && !blocked && row.pricePaise !== null ? (
                  <tr className="bg-muted/40">
                    <td colSpan={5} className="px-4 py-3">
                      <dl className="flex flex-wrap items-end gap-x-8 gap-y-2 pl-[4.75rem]">
                        <dt className="self-center text-caption uppercase tracking-wide text-muted-foreground">
                          {d.breakdown}
                        </dt>
                        {charges.map((ch) => (
                          <div key={ch.kind} className="flex flex-col">
                            <dt className="text-caption text-muted-foreground">
                              {c.charge[ch.kind]}
                            </dt>
                            <dd className="font-medium tabular-nums text-ink-strong">
                              {fmt.money(ch.pricePaise)}
                            </dd>
                          </div>
                        ))}
                        {charges.length === 0 ? (
                          <dd className="text-caption text-muted-foreground">{c.noBreakdown}</dd>
                        ) : null}
                        <div className="flex flex-col">
                          <dt className="text-caption text-muted-foreground">{d.youPay}</dt>
                          <dd className="font-semibold tabular-nums text-ink-strong">
                            {fmt.money(row.pricePaise)}
                          </dd>
                        </div>
                      </dl>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
