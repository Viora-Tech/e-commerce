'use client'

import type { DeliveryOption } from '@commerce/core/delivery-options'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import SwitchRow from '@/components/fields/switch-row'
import { deliveryOptionQuestionsContent } from '@/data/delivery-option-questions'
import { deliveryOptionSectionsContent } from '@/data/delivery-option-sections'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy } from '@/hooks/use-copy'
import CodFeeField from './cod-fee-field'
import InlineWarning from './inline-warning'
import InsuranceOfferFields from './insurance-offer-fields'
import ListPriceFields from './list-price-fields'
import { ONE_COURIER } from './option-answers'
import OptionSection from './option-section'

type ListMoreFieldsProps = {
  /** The option the courier list prices from: the first one shown. */
  option: DeliveryOption
  onChange: (next: DeliveryOption) => void
}

/** Two to eight cards, as the engine allows, or every courier (`null`, the default). */
const MAX_CHOICES = [2, 3, 4, 5, 6, 7, 8] as const
const ALL = 'all'

/**
 * Everything on the courier list that is not one of the 3 questions (owner, 21 Nov 2026), in
 * the one "More settings": price amounts and limits, which courier is included, how many show
 * and which hide, the rarely wanted "faster couriers at the first courier's price", parcel
 * insurance and the cash on delivery fee.
 */
export default function ListMoreFields({ option, onChange }: ListMoreFieldsProps) {
  // Hooks
  const pages = useCopy(deliveryPagesContent)
  const sections = useCopy(deliveryOptionSectionsContent)
  const copy = useCopy(deliveryOptionQuestionsContent)

  // Helpers
  const setCouriers = (patch: Partial<DeliveryOption['couriers']>) =>
    onChange({ ...option, couriers: { ...option.couriers, ...patch } })

  // Render logic
  const c = pages.courierList
  const s = sections.sections
  const many = option.couriers.max !== ONE_COURIER
  const codFee = option.cod.mode === 'allowed' && option.speed === 'standard'

  return (
    <>
      {option.price.source === 'free' ? null : (
        <OptionSection title={copy.more.price}>
          <ListPriceFields option={option} onChange={onChange} />
        </OptionSection>
      )}
      <OptionSection title={s.couriers.title}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ChoiceField
            id="courier-list-included"
            label={c.includedService}
            value={option.strategy}
            options={[
              { value: 'cheapest', label: c.includedItems.cheapest },
              { value: 'fastest', label: c.includedItems.fastest },
            ]}
            onChange={(v) =>
              onChange({ ...option, strategy: v === 'fastest' ? 'fastest' : 'cheapest' })
            }
          />
          {many ? (
            <ChoiceField
              id="courier-list-max"
              label={c.max}
              value={option.couriers.max == null ? ALL : String(option.couriers.max)}
              options={[
                { value: ALL, label: c.maxAll },
                ...MAX_CHOICES.map((n) => ({ value: String(n), label: c.maxItems(n) })),
              ]}
              onChange={(v) => setCouriers({ max: v === ALL ? null : Number(v) })}
            />
          ) : null}
        </div>
        {many ? (
          <div className="flex flex-col">
            <SwitchRow
              id="courier-list-hide"
              label={c.hide}
              description={c.hideHelp}
              checked={option.couriers.hideSlowerDearer}
              onChange={(on) => setCouriers({ hideSlowerDearer: on })}
              className="py-3"
              weight="semibold"
              divided
            />
            <SwitchRow
              id="courier-list-same"
              label={copy.more.sameAsFirst}
              description={copy.more.sameAsFirstHelp}
              checked={option.couriers.extra === 'none'}
              onChange={(on) => setCouriers({ extra: on ? 'none' : 'difference' })}
              className="py-3"
              weight="semibold"
              divided
            />
          </div>
        ) : null}
        {many && option.strategy === 'fastest' && option.couriers.hideSlowerDearer ? (
          <InlineWarning>{c.hideFastest}</InlineWarning>
        ) : null}
      </OptionSection>
      <OptionSection title={s.extras.title}>
        <InsuranceOfferFields option={option} onChange={onChange} idPrefix="courier-list" />
        {codFee ? (
          <CodFeeField
            id="courier-list-cod-fee"
            value={option.cod.fee}
            onChange={(fee) => onChange({ ...option, cod: { ...option.cod, fee } })}
          />
        ) : null}
      </OptionSection>
    </>
  )
}
