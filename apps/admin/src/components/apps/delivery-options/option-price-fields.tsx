'use client'

import { deliveryOptionQuestionsContent } from '@/data/delivery-option-questions'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import NumberField from './number-field'
import type { OptionForm as Form } from './option-form-state'
import OptionSection from './option-section'
import RupeeField from './rupee-field'

type OptionPriceFieldsProps = {
  form: Form
  onChange: (next: Form) => void
}

/**
 * "Price" in an option page's "More settings" (owner, 21 Nov 2026): markup in rupees and percent
 * (on the courier cost only), free above an order value and the price limits. Free delivery:
 * the store pays the courier, so none of them apply and the section hides.
 */
export default function OptionPriceFields({ form, onChange }: OptionPriceFieldsProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const questions = useCopy(deliveryOptionQuestionsContent)

  // Helpers
  const set =
    <K extends keyof Form>(key: K) =>
    (value: Form[K]) =>
      onChange({ ...form, [key]: value })

  // Early returns
  if (form.priceSource === 'free') return null

  // Render logic
  const o = copy.option.price

  return (
    <OptionSection title={questions.more.price}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {form.priceSource === 'route' ? (
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
    </OptionSection>
  )
}
