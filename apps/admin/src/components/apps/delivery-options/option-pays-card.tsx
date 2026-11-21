'use client'

import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import SettingsCard from '@/components/settings/settings-card'
import { deliveryOptionSectionsContent } from '@/data/delivery-option-sections'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import FasterCostField from './faster-cost-field'
import NumberField from './number-field'
import OptionExampleLine from './option-example-line'
import { exampleOptionOf, type OptionForm as Form } from './option-form-state'
import RoundingField from './rounding-field'
import RupeeField from './rupee-field'

type OptionPaysCardProps = {
  form: Form
  onChange: (next: Form) => void
}

const PRICE_SOURCES = ['route', 'zone', 'free'] as const

/**
 * "What the shopper pays" on an option's page (owner, 21 Nov 2026): where the price comes from,
 * rounding and (on a courier list) what faster couriers cost first, a live checkout example
 * under them, then markup, free above and the price limits.
 */
export default function OptionPaysCard({ form, onChange }: OptionPaysCardProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const sections = useCopy(deliveryOptionSectionsContent)

  // Helpers
  const set =
    <K extends keyof Form>(key: K) =>
    (value: Form[K]) =>
      onChange({ ...form, [key]: value })

  // Render logic
  const o = copy.option.price
  const s = sections.sections
  const example = exampleOptionOf(form)
  const route = form.priceSource === 'route'

  return (
    <SettingsCard title={s.pays.title} description={s.pays.help} bodyClassName="gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ChoiceField
          id="opt-price-source"
          label={o.source}
          value={form.priceSource}
          options={PRICE_SOURCES.map((v) => ({ value: v, label: o.sources[v] }))}
          onChange={(v) => set('priceSource')(PRICE_SOURCES.find((x) => x === v) ?? 'route')}
        />
        <RoundingField
          id="opt-round"
          value={form.rounding}
          help={form.couriersList ? 'list' : 'fixed'}
          onChange={set('rounding')}
        />
        {form.couriersList ? (
          <FasterCostField
            id="opt-faster"
            value={form.couriersExtra}
            onChange={set('couriersExtra')}
          />
        ) : null}
      </div>
      {example ? <OptionExampleLine option={example} /> : null}
      {/* Free: the store pays the courier, so no markup, threshold or limits apply. */}
      {form.priceSource === 'free' ? null : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {route ? (
            <>
              <RupeeField
                id="opt-markup"
                label={o.markup}
                value={form.markup}
                onChange={set('markup')}
              />
              <NumberField
                id="opt-markup-pct"
                label={o.markupPercent}
                value={form.markupPercent}
                onChange={set('markupPercent')}
                suffix="%"
              />
            </>
          ) : null}
          <RupeeField
            id="opt-free-above"
            label={o.freeAbove}
            value={form.freeAbove}
            onChange={set('freeAbove')}
          />
          <RupeeField id="opt-min" label={o.min} value={form.min} onChange={set('min')} />
          <RupeeField id="opt-max" label={o.max} value={form.max} onChange={set('max')} />
        </div>
      )}
    </SettingsCard>
  )
}
