'use client'

import type { RulePriceMode } from '@commerce/core/delivery-options'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { FieldDescription, FieldError } from '@commerce/ui/shadcn/field'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import MoneyInput from '@/components/fields/money-input'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { deliveryRuleFormContent } from '@/data/delivery-rule-form'
import { useCopy } from '@/hooks/use-copy'
import { carrierName } from './format'
import { type RuleDraft, type RuleErrors, ruleCarriers } from './rule-draft'

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
 * the normal delivery price, Free or Fixed ₹ (optionally a different price for some couriers,
 * owner 21 Nov 2026), "Free above ₹X" (cart value) and a packing charge (not on Free). Saved
 * as the rule's `price`.
 */
export default function RulePriceFields({ draft, errors, onChange }: RulePriceFieldsProps) {
  // Hooks
  const form = useCopy(deliveryRuleFormContent)
  const copy = useCopy(deliveryOptionsContent)

  // Event handlers
  const handleCourierFixed = (carrier: string, value: string) =>
    onChange({ courierFixed: { ...draft.courierFixed, [carrier]: value } })

  // Render logic
  const t = form.price
  const labels: Record<RulePriceMode, string> = { option: t.option, free: t.free, fixed: t.fixed }
  // Only worth asking when the rule has more than one courier.
  const carriers = draft.priceMode === 'fixed' ? ruleCarriers(draft) : []

  return (
    <div className="flex flex-col gap-3">
      <RadioGroup
        value={draft.priceMode}
        onValueChange={(v) => onChange({ priceMode: modeOf(String(v)) })}
      >
        {MODES.map((m) => (
          <div key={m} className="flex min-h-8 flex-wrap items-center gap-2">
            <label
              htmlFor={`rule-price-${m}`}
              className="flex cursor-pointer items-center gap-2 text-body"
            >
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
      {carriers.length > 1 ? (
        <fieldset className="flex flex-col gap-2 rounded-md border border-hairline px-3 py-2.5">
          <legend className="px-1 text-caption font-medium text-ink-strong">
            {t.courierPrices}
          </legend>
          <FieldDescription>{t.courierPricesHelp}</FieldDescription>
          {carriers.map((carrier) => {
            const name = carrierName(carrier, copy.routeDialog.anyCourier)
            return (
              <div key={carrier} className="flex min-h-8 items-center justify-between gap-3">
                <label htmlFor={`rule-courier-price-${carrier}`} className="text-body">
                  {name}
                </label>
                <div className="w-32">
                  <MoneyInput
                    id={`rule-courier-price-${carrier}`}
                    aria-label={t.courierPriceLabel(name)}
                    value={draft.courierFixed[carrier] ?? ''}
                    placeholder={draft.fixed}
                    onChange={(value) => handleCourierFixed(carrier, value)}
                  />
                </div>
              </div>
            )
          })}
          {errors?.courierFixed ? <FieldError>{t.errors.courierFixed}</FieldError> : null}
        </fieldset>
      ) : null}
      {draft.priceMode === 'free' ? null : (
        <div className="flex min-h-8 flex-wrap items-center gap-2">
          <label
            htmlFor="rule-free-above"
            className="flex cursor-pointer items-center gap-2 text-body"
          >
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
      {draft.priceMode === 'free' ? null : (
        <div className="flex min-h-8 flex-wrap items-center gap-2">
          <label htmlFor="rule-packing" className="text-body">
            {t.packing}
          </label>
          <div className="w-32">
            <MoneyInput
              id="rule-packing"
              aria-label={t.packingLabel}
              value={draft.packing}
              invalid={errors?.packing}
              onChange={(packing) => onChange({ packing })}
            />
          </div>
          <FieldDescription>{t.packingHelp}</FieldDescription>
        </div>
      )}
      {errors?.packing ? <FieldError>{t.errors.packing}</FieldError> : null}
    </div>
  )
}
