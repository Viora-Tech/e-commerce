'use client'

import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import SettingsCard from '@/components/settings/settings-card'
import SettingsToggleRow from '@/components/settings/settings-toggle-row'
import { deliveryOptionSectionsContent } from '@/data/delivery-option-sections'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import NumberField from './number-field'
import OptionCouriersCard from './option-couriers-card'
import OptionExtrasCard from './option-extras-card'
import type { OptionForm as Form } from './option-form-state'
import OptionPaysCard from './option-pays-card'

type OptionFormProps = {
  form: Form
  onChange: (next: Form) => void
}

/**
 * The option page's cards, most used first (owner, 21 Nov 2026): name and status, what the
 * shopper pays (with a live checkout example), which couriers show, insurance and cash on
 * delivery, then delivery dates.
 */
export default function OptionForm({ form, onChange }: OptionFormProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const sections = useCopy(deliveryOptionSectionsContent)

  // Helpers
  const set =
    <K extends keyof Form>(key: K) =>
    (value: Form[K]) =>
      onChange({ ...form, [key]: value })

  // Render logic
  const o = copy.option
  const s = sections.sections

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard title={s.basics.title} bodyClassName="gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="opt-name">{o.display.name}</FieldLabel>
            <Input
              id="opt-name"
              value={form.name}
              placeholder={o.display.namePlaceholder}
              onChange={(e) => set('name')(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="opt-description">{o.display.description}</FieldLabel>
            <Input
              id="opt-description"
              value={form.description}
              placeholder={o.display.descriptionPlaceholder}
              onChange={(e) => set('description')(e.target.value)}
            />
          </Field>
        </div>
        <SettingsToggleRow
          id="opt-enabled"
          label={o.availability.enabled}
          checked={form.enabled}
          onChange={set('enabled')}
        />
      </SettingsCard>

      <OptionPaysCard form={form} onChange={onChange} />
      <OptionCouriersCard form={form} onChange={onChange} />
      <OptionExtrasCard form={form} onChange={onChange} />

      <SettingsCard title={s.dates.title} description={s.dates.help} bodyClassName="gap-4">
        <ChoiceField
          id="opt-eta"
          label={o.arrival.source}
          value={form.etaSource}
          options={(['route', 'fixed'] as const).map((v) => ({
            value: v,
            label: o.arrival.sources[v],
          }))}
          onChange={(v) => set('etaSource')(v === 'fixed' ? 'fixed' : 'route')}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {form.etaSource === 'fixed' ? (
            <>
              <NumberField
                id="opt-fixed-min"
                label={o.arrival.fixedMin}
                value={form.fixedMin}
                onChange={set('fixedMin')}
              />
              <NumberField
                id="opt-fixed-max"
                label={o.arrival.fixedMax}
                value={form.fixedMax}
                onChange={set('fixedMax')}
              />
            </>
          ) : null}
          <NumberField
            id="opt-processing"
            label={o.arrival.processing}
            value={form.processing}
            onChange={set('processing')}
          />
          <NumberField
            id="opt-buffer"
            label={o.arrival.buffer}
            value={form.buffer}
            onChange={set('buffer')}
          />
          <NumberField
            id="opt-max-days"
            label={o.arrival.maxDays}
            value={form.maxDays}
            onChange={set('maxDays')}
          />
        </div>
      </SettingsCard>
    </div>
  )
}
