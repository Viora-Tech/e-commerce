'use client'

import type { DeliveryOption } from '@commerce/core/delivery-options'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import DataCard from '@/components/layout/data-card'
import SettingsToggleRow from '@/components/settings/settings-toggle-row'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy, useFormat } from '@/hooks/use-copy'
import CodFeeField from './cod-fee-field'
import InlineWarning from './inline-warning'
import InsuranceOfferFields from './insurance-offer-fields'
import RoundingField from './rounding-field'

type PriceIncludesCardProps = {
  /** The option the courier list prices from: the first one shown. */
  option: DeliveryOption
  onChange: (next: DeliveryOption) => void
}

/** Two to eight cards, as the engine allows, or every courier (`null`, the new default). */
const MAX_CHOICES = [2, 3, 4, 5, 6, 7, 8] as const
const ALL = 'all'

type Source = DeliveryOption['price']['source']

/** The select's value back to a price source; anything unknown is the courier cost. */
const sourceOf = (v: string): Source => (v === 'zone' || v === 'free' ? v : 'route')

/**
 * "What the price includes" (Figma 938:12101): the included courier, what shoppers pay for it
 * (courier cost, Shipping rates or free), what faster ones add, and parcel insurance.
 */
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
    <DataCard title={c.priceTitle} bodyClassName="flex flex-col gap-4">
      <ChoiceField
        id="courier-list-included"
        label={c.includedService}
        value={option.strategy}
        options={[
          { value: 'cheapest', label: c.includedItems.cheapest },
          { value: 'fastest', label: c.includedItems.fastest },
        ]}
        help={
          option.price.source === 'free'
            ? undefined
            : c.includedHelp(free != null ? fmt.money(free) : null)
        }
        onChange={(v) =>
          onChange({ ...option, strategy: v === 'fastest' ? 'fastest' : 'cheapest' })
        }
      />
      <ChoiceField
        id="courier-list-pays"
        label={c.pays}
        value={option.price.source}
        options={(['route', 'zone', 'free'] as const).map((v) => ({
          value: v,
          label: c.paysItems[v],
        }))}
        onChange={(v) => onChange({ ...option, price: { ...option.price, source: sourceOf(v) } })}
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
      <RoundingField
        id="courier-list-round"
        value={option.price.rounding}
        onChange={(rounding) =>
          onChange({
            ...option,
            price: { ...option.price, rounding },
            // The old "+₹…9" switch only counts on the ₹10 rule; Off turns it off too.
            couriers: { ...option.couriers, roundTo9: rounding !== 'off' },
          })
        }
      />
      <div className="flex flex-col">
        <SettingsToggleRow
          id="courier-list-hide"
          label={c.hide}
          description={c.hideHelp}
          checked={option.couriers.hideSlowerDearer}
          onChange={(on) => setCouriers({ hideSlowerDearer: on })}
          className="py-3"
        />
        {option.strategy === 'fastest' && option.couriers.hideSlowerDearer ? (
          <InlineWarning className="mb-3">{c.hideFastest}</InlineWarning>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-body font-semibold text-ink-strong">{c.max}</span>
        <div className="w-40">
          <ChoiceField
            id="courier-list-max"
            label={c.max}
            hideLabel
            value={option.couriers.max == null ? ALL : String(option.couriers.max)}
            options={[
              { value: ALL, label: c.maxAll },
              ...MAX_CHOICES.map((n) => ({ value: String(n), label: c.maxItems(n) })),
            ]}
            onChange={(v) => setCouriers({ max: v === ALL ? null : Number(v) })}
          />
        </div>
      </div>
      <div className="border-t border-hairline pt-4">
        <InsuranceOfferFields option={option} onChange={onChange} idPrefix="courier-list" />
      </div>
      {option.cod.mode === 'allowed' && option.speed === 'standard' ? (
        <CodFeeField
          id="courier-list-cod-fee"
          value={option.cod.fee}
          onChange={(fee) => onChange({ ...option, cod: { ...option.cod, fee } })}
        />
      ) : null}
    </DataCard>
  )
}
