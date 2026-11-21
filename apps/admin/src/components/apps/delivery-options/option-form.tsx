'use client'

import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import SettingsCard from '@/components/settings/settings-card'
import SettingsToggleRow from '@/components/settings/settings-toggle-row'
import { deliveryOptionQuestionsContent } from '@/data/delivery-option-questions'
import { deliveryOptionSectionsContent } from '@/data/delivery-option-sections'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import DeliveryQuestions from './delivery-questions'
import MoreSettings from './more-settings'
import { formFasterOf, formMoreChanged, formWithFaster } from './option-answers'
import OptionCouriersFields from './option-couriers-fields'
import OptionDatesFields from './option-dates-fields'
import OptionExtrasFields from './option-extras-fields'
import { exampleOptionOf, type OptionForm as Form } from './option-form-state'
import OptionPriceFields from './option-price-fields'

type OptionFormProps = {
  form: Form
  onChange: (next: Form) => void
}

/**
 * The option page (owner, 21 Nov 2026): name, speed and status, then the same 3 questions as the
 * Options page (question 2 only when shoppers may pick the courier) with the live checkout
 * example, and everything else (price amounts and limits, couriers, insurance and cash on
 * delivery, dates) in one collapsed "More settings".
 */
export default function OptionForm({ form, onChange }: OptionFormProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const sections = useCopy(deliveryOptionSectionsContent)
  const questions = useCopy(deliveryOptionQuestionsContent)

  // Helpers
  const set =
    <K extends keyof Form>(key: K) =>
    (value: Form[K]) =>
      onChange({ ...form, [key]: value })

  // Render logic
  const o = copy.option
  const r = o.routing

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard title={sections.sections.basics.title} bodyClassName="gap-4">
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
          <ChoiceField
            id="opt-speed"
            label={r.speed}
            value={form.speed}
            options={(['standard', 'express'] as const).map((v) => ({
              value: v,
              label: r.speeds[v],
            }))}
            onChange={(v) => set('speed')(v === 'express' ? 'express' : 'standard')}
          />
        </div>
        <SettingsToggleRow
          id="opt-enabled"
          label={o.availability.enabled}
          checked={form.enabled}
          onChange={set('enabled')}
        />
      </SettingsCard>

      <SettingsCard title={questions.title} bodyClassName="gap-5">
        <DeliveryQuestions
          idPrefix="opt"
          example={exampleOptionOf(form)}
          whoPays={form.priceSource}
          onWhoPays={set('priceSource')}
          askFaster={form.couriersList}
          faster={formFasterOf(form)}
          onFaster={(answer) => onChange(formWithFaster(form, answer))}
          rounding={form.rounding}
          onRounding={set('rounding')}
        />
        <MoreSettings hint={questions.more.hintOption} changed={formMoreChanged(form).length}>
          <OptionPriceFields form={form} onChange={onChange} />
          <OptionCouriersFields form={form} onChange={onChange} />
          <OptionExtrasFields form={form} onChange={onChange} />
          <OptionDatesFields form={form} onChange={onChange} />
        </MoreSettings>
      </SettingsCard>
    </div>
  )
}
