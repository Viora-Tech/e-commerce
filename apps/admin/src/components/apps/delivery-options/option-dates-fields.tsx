'use client'

import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import { deliveryOptionSectionsContent } from '@/data/delivery-option-sections'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import NumberField from './number-field'
import type { OptionForm as Form } from './option-form-state'
import OptionSection from './option-section'

type OptionDatesFieldsProps = {
  form: Form
  onChange: (next: Form) => void
}

/** "Delivery dates" in an option page's "More settings": where the date comes from, fixed days,
 *  processing and buffer days, and the longest transit allowed. Split from option-form.tsx. */
export default function OptionDatesFields({ form, onChange }: OptionDatesFieldsProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const sections = useCopy(deliveryOptionSectionsContent)

  // Helpers
  const set =
    <K extends keyof Form>(key: K) =>
    (value: Form[K]) =>
      onChange({ ...form, [key]: value })

  // Render logic
  const o = copy.option.arrival
  const s = sections.sections.dates

  return (
    <OptionSection title={s.title} help={s.help}>
      <ChoiceField
        id="opt-eta"
        label={o.source}
        value={form.etaSource}
        options={(['route', 'fixed'] as const).map((v) => ({ value: v, label: o.sources[v] }))}
        onChange={(v) => set('etaSource')(v === 'fixed' ? 'fixed' : 'route')}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {form.etaSource === 'fixed' ? (
          <>
            <NumberField
              id="opt-fixed-min"
              label={o.fixedMin}
              value={form.fixedMin}
              onChange={set('fixedMin')}
            />
            <NumberField
              id="opt-fixed-max"
              label={o.fixedMax}
              value={form.fixedMax}
              onChange={set('fixedMax')}
            />
          </>
        ) : null}
        <NumberField
          id="opt-processing"
          label={o.processing}
          value={form.processing}
          onChange={set('processing')}
        />
        <NumberField
          id="opt-buffer"
          label={o.buffer}
          value={form.buffer}
          onChange={set('buffer')}
        />
        <NumberField
          id="opt-max-days"
          label={o.maxDays}
          value={form.maxDays}
          onChange={set('maxDays')}
        />
      </div>
    </OptionSection>
  )
}
