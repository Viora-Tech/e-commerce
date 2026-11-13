'use client'

import type { DeliveryOption } from '@commerce/core/delivery-options'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import SettingsToggleRow from '@/components/settings/settings-toggle-row'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy, useFormat } from '@/hooks/use-copy'

type PriceIncludesCardProps = {
  /** The option the courier list prices from: the first one shown. */
  option: DeliveryOption
  onChange: (next: DeliveryOption) => void
}

/** Two to eight cards, as the engine allows. */
const MAX_CHOICES = [2, 3, 4, 5, 6, 7, 8] as const

/** "What the price includes" (Figma 938:12101): the included courier and what faster ones add. */
export default function PriceIncludesCard({ option, onChange }: PriceIncludesCardProps) {
  // Hooks
  const pages = useCopy(deliveryPagesContent)
  const fmt = useFormat()

  // Helpers
  const setCouriers = (patch: Partial<DeliveryOption['couriers']>) =>
    onChange({ ...option, couriers: { ...option.couriers, ...patch } })

  // Render logic
  const c = pages.courierList
  const free = option.price.freeAbovePaise

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-panel-border bg-card p-4">
      <h2 className="text-card-title text-ink-strong">{c.priceTitle}</h2>
      <ChoiceField
        id="courier-list-included"
        label={c.includedService}
        value={option.strategy}
        options={[
          { value: 'cheapest', label: c.includedItems.cheapest },
          { value: 'fastest', label: c.includedItems.fastest },
        ]}
        help={c.includedHelp(free != null ? fmt.money(free) : null)}
        onChange={(v) =>
          onChange({ ...option, strategy: v === 'fastest' ? 'fastest' : 'cheapest' })
        }
      />
      <ChoiceField
        id="courier-list-extra"
        label={c.fasterCost}
        value={option.couriers.extra}
        options={[
          { value: 'difference', label: c.fasterItems.difference },
          { value: 'none', label: c.fasterItems.none },
        ]}
        onChange={(v) => setCouriers({ extra: v === 'none' ? 'none' : 'difference' })}
      />
      <div className="flex flex-col">
        <SettingsToggleRow
          id="courier-list-round"
          label={c.round}
          description={c.roundHelp}
          checked={option.couriers.roundTo9}
          onChange={(on) => setCouriers({ roundTo9: on })}
          className="py-3"
        />
        <SettingsToggleRow
          id="courier-list-hide"
          label={c.hide}
          description={c.hideHelp}
          checked={option.couriers.hideSlowerDearer}
          onChange={(on) => setCouriers({ hideSlowerDearer: on })}
          className="py-3"
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-body font-semibold text-ink-strong">{c.max}</span>
        <div className="w-40">
          <ChoiceField
            id="courier-list-max"
            label={c.max}
            hideLabel
            value={String(option.couriers.max)}
            options={MAX_CHOICES.map((n) => ({ value: String(n), label: c.maxItems(n) }))}
            onChange={(v) => setCouriers({ max: Number(v) })}
          />
        </div>
      </div>
    </section>
  )
}
