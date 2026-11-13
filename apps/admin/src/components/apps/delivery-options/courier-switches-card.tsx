'use client'

import { Switch } from '@commerce/ui/shadcn/switch'
import StatusChip from '@/components/layout/status-chip'
import CourierMark from '@/components/shipments/create-shipment/courier-mark'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy } from '@/hooks/use-copy'
import type { CourierRow } from './courier-rows'

type CourierSwitchesCardProps = {
  rows: CourierRow[]
  loading: boolean
  /** Which rows are on. */
  isOn: (id: string) => boolean
  /** A courier the apps started offering after the last save (it starts off). */
  isNew: (id: string) => boolean
  /** The courier the preview shopper's price includes. */
  includedId: string | null
  onToggle: (id: string, on: boolean) => void
}

/** "Couriers shoppers may see" (Figma 938:12101): every courier the apps offer, each switchable. */
export default function CourierSwitchesCard({
  rows,
  loading,
  isOn,
  isNew,
  includedId,
  onToggle,
}: CourierSwitchesCardProps) {
  // Hooks
  const pages = useCopy(deliveryPagesContent)

  // Helpers
  const sub = (row: CourierRow) => {
    const line = row.direct
      ? pages.courierList.direct
      : row.via.length > 1
        ? pages.courierList.cheaperWins(row.via.join(' · '))
        : pages.courierList.via(row.via.join(''))
    return isNew(row.id) ? `${line} · ${pages.courierList.newSuffix}` : line
  }

  // Render logic
  const c = pages.courierList

  return (
    <section className="flex flex-col gap-1 rounded-xl border border-panel-border bg-card p-4">
      <h2 className="text-card-title text-ink-strong">{c.title}</h2>
      <p className="text-caption text-muted-foreground">{c.help}</p>
      {rows.length === 0 ? (
        <p className="pt-3 text-body text-muted-foreground">{loading ? c.loading : c.empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {rows.map((row) => {
            const name = `${row.carrier} ${pages.routeTable.speeds[row.speed]}`
            return (
              <li key={row.id} className="flex items-center gap-3 border-t border-hairline py-3">
                <CourierMark label={row.carrier} className="h-8 w-12" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body font-medium text-ink-strong">{name}</span>
                  <span className="truncate text-caption text-muted-foreground">{sub(row)}</span>
                </span>
                {row.id === includedId ? (
                  <StatusChip tone="success">{c.included}</StatusChip>
                ) : null}
                {isNew(row.id) ? <StatusChip tone="attention">{c.new}</StatusChip> : null}
                <Switch
                  checked={isOn(row.id)}
                  onCheckedChange={(on) => onToggle(row.id, on)}
                  aria-label={c.toggle(name)}
                />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
