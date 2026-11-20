'use client'

import type { RulePriceMode } from '@commerce/core/delivery-options'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { FieldDescription, FieldError } from '@commerce/ui/shadcn/field'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import MoneyInput from '@/components/fields/money-input'
import { deliveryRuleFormContent } from '@/data/delivery-rule-form'
import { useCopy } from '@/hooks/use-copy'
import type { RuleDraft, RuleErrors } from './rule-draft'

type RulePriceFieldsProps = {
  draft: RuleDraft
  /** Shown only after a save was tried. */
  errors: RuleErrors | null
  onChange: (patch: Partial<RuleDraft>) => void
}

const MODES: readonly RulePriceMode[] = ['option', 'free', 'fixed']

const modeOf = (v: string): RulePriceMode => (v === 'free' || v === 'fixed' ? v : 'option')

/**
 * Step 4 of the product rule dialog, "What does the included courier cost the shopper?":
 * the normal delivery price, Free or Fixed ₹, and "Free above ₹X" (cart value). Saved as the
 * rule's `price`.
 */
export default function RulePriceFields({ draft, errors, onChange }: RulePriceFieldsProps) {
  // Hooks
  const form = useCopy(deliveryRuleFormContent)

  // Render logic
  const t = form.price
  const labels: Record<RulePriceMode, string> = { option: t.option, free: t.free, fixed: t.fixed }

  return (
    <div className="flex flex-col gap-3">
      <RadioGroup value={draft.priceMode} onValueChange={(v) => onChange({ priceMode: modeOf(String(v)) })}>
        {MODES.map((m) => (
          <div key={m} className="flex min-h-8 flex-wrap items-center gap-2">
            <label htmlFor={`rule-price-${m}`} className="flex cursor-pointer items-center gap-2 text-body">
              <RadioGroupItem id={`rule-price-${m}`} value={m} />
              {labels[m]}
            </label>
            {m === 'option' ? <FieldDescription>{t.optionHelp}</FieldDescription> : null}
            {m === 'fixed' && draft.priceMode === 'fixed' ? (
              <div className="w-32">
                <MoneyInput
                  id="rule-price-fixed-amount"
                  aria-label={t.fixedLabel}
                  value={draft.fixed}
                  invalid={errors?.fixed}
                  onChange={(fixed) => onChange({ fixed })}
                />
              </div>
            ) : null}
          </div>
        ))}
      </RadioGroup>
      {errors?.fixed ? <FieldError>{t.errors.fixed}</FieldError> : null}
      {draft.priceMode === 'free' ? null : (
        <div className="flex min-h-8 flex-wrap items-center gap-2">
          <label htmlFor="rule-free-above" className="flex cursor-pointer items-center gap-2 text-body">
            <Checkbox
              id="rule-free-above"
              checked={draft.freeAboveOn}
              onCheckedChange={(v) => onChange({ freeAboveOn: Boolean(v) })}
            />
            {t.freeAbove}
          </label>
          {draft.freeAboveOn ? (
            <div className="w-36">
              <MoneyInput
                id="rule-free-above-amount"
                aria-label={t.freeAboveLabel}
                value={draft.freeAbove}
                invalid={errors?.freeAbove}
                onChange={(freeAbove) => onChange({ freeAbove })}
              />
            </div>
          ) : null}
          <FieldDescription>{t.freeAboveHelp}</FieldDescription>
        </div>
      )}
      {errors?.freeAbove ? <FieldError>{t.errors.freeAbove}</FieldError> : null}
    </div>
  )
}
