'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup } from '@commerce/ui/shadcn/radio-group'
import MoneyInput from '@/components/fields/money-input'
import RadioOption from '@/components/fields/radio-option'
import RequiredMark from '@/components/fields/required-mark'
import DataCard from '@/components/layout/data-card'
import { discountFormContent } from '@/data/discounts'
import { useCopy } from '@/hooks/use-copy'
import AppliesToPicker from './applies-to-picker'
import type { DiscountFormState, ItemScope } from './form-state'

type BxgyCardProps = {
  form: Pick<
    DiscountFormState,
    | 'buysKind'
    | 'buysQuantity'
    | 'buysAmount'
    | 'buysScope'
    | 'buysIds'
    | 'getsQuantity'
    | 'getsScope'
    | 'getsIds'
    | 'getsMode'
    | 'value'
    | 'limitPerOrder'
    | 'maxUsesPerOrder'
  >
  errors: { buys?: string; buysItems?: string; gets?: string; getsItems?: string; value?: string }
  onChange: (patch: Partial<DiscountFormState>) => void
}

const MODES = ['free', 'percent', 'fixed'] as const

/** Buy X get Y: "Customer buys" and "Customer gets", as on Shopify's create page. */
export default function BxgyCard({ form, errors, onChange }: BxgyCardProps) {
  // Hooks
  const { bxgy: copy } = useCopy(discountFormContent)

  // Render logic
  const quantityMode = form.buysKind === 'quantity'

  return (
    <>
      <DataCard title={copy.buysHeading}>
        <FieldGroup>
          <RadioGroup
            value={form.buysKind}
            onValueChange={(v) => onChange({ buysKind: v as 'quantity' | 'amount' })}
            className="gap-2"
          >
            <RadioOption id="buys-quantity" value="quantity" label={copy.buysQuantity} />
            <RadioOption id="buys-amount" value="amount" label={copy.buysAmount} />
          </RadioGroup>
          <Field data-invalid={errors.buys ? true : undefined} className="max-w-xs">
            <FieldLabel htmlFor="buys-value">
              {quantityMode ? copy.quantity : copy.amount}
              <RequiredMark />
            </FieldLabel>
            {quantityMode ? (
              <Input
                size="lg"
                id="buys-value"
                type="number"
                inputMode="numeric"
                min={1}
                value={form.buysQuantity}
                onChange={(e) => onChange({ buysQuantity: e.target.value })}
                aria-invalid={errors.buys ? true : undefined}
              />
            ) : (
              <MoneyInput
                size="lg"
                id="buys-value"
                value={form.buysAmount}
                onChange={(buysAmount) => onChange({ buysAmount })}
                invalid={errors.buys ? true : undefined}
              />
            )}
            {errors.buys ? <FieldError>{errors.buys}</FieldError> : null}
          </Field>
          <Field data-invalid={errors.buysItems ? true : undefined}>
            <FieldLabel>{copy.itemsFrom}</FieldLabel>
            <AppliesToPicker
              kind={form.buysScope}
              ids={form.buysIds}
              onChange={({ kind, ids }: { kind: ItemScope; ids: string[] }) =>
                onChange({ buysScope: kind, buysIds: ids })
              }
            />
            {errors.buysItems ? <FieldError>{errors.buysItems}</FieldError> : null}
          </Field>
        </FieldGroup>
      </DataCard>

      <DataCard title={copy.getsHeading}>
        <FieldGroup>
          <FieldDescription>{copy.getsHelp}</FieldDescription>
          <Field data-invalid={errors.gets ? true : undefined} className="max-w-xs">
            <FieldLabel htmlFor="gets-quantity">
              {copy.quantity}
              <RequiredMark />
            </FieldLabel>
            <Input
              size="lg"
              id="gets-quantity"
              type="number"
              inputMode="numeric"
              min={1}
              value={form.getsQuantity}
              onChange={(e) => onChange({ getsQuantity: e.target.value })}
              aria-invalid={errors.gets ? true : undefined}
            />
            {errors.gets ? <FieldError>{errors.gets}</FieldError> : null}
          </Field>
          <Field data-invalid={errors.getsItems ? true : undefined}>
            <FieldLabel>{copy.itemsFrom}</FieldLabel>
            <AppliesToPicker
              kind={form.getsScope}
              ids={form.getsIds}
              onChange={({ kind, ids }: { kind: ItemScope; ids: string[] }) =>
                onChange({ getsScope: kind, getsIds: ids })
              }
            />
            {errors.getsItems ? <FieldError>{errors.getsItems}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel>{copy.atValue}</FieldLabel>
            <RadioGroup
              value={form.getsMode}
              onValueChange={(v) => onChange({ getsMode: v as DiscountFormState['getsMode'] })}
              className="gap-2"
            >
              {MODES.map((m) => (
                <RadioOption key={m} id={`gets-${m}`} value={m} label={copy.modes[m]} />
              ))}
            </RadioGroup>
          </Field>
          {form.getsMode === 'free' ? null : (
            <Field data-invalid={errors.value ? true : undefined} className="max-w-xs">
              <MoneyInput
                size="lg"
                aria-label={copy.modes[form.getsMode]}
                value={form.value}
                onChange={(value) => onChange({ value })}
                currency={form.getsMode === 'fixed'}
                suffix={form.getsMode === 'percent' ? '%' : undefined}
                invalid={errors.value ? true : undefined}
              />
              {errors.value ? <FieldError>{errors.value}</FieldError> : null}
            </Field>
          )}
          <Field orientation="horizontal">
            <Checkbox
              id="bxgy-limit"
              checked={form.limitPerOrder}
              onCheckedChange={(v) => onChange({ limitPerOrder: Boolean(v) })}
            />
            <FieldLabel htmlFor="bxgy-limit" className="font-normal">
              {copy.limitPerOrder}
            </FieldLabel>
          </Field>
          {form.limitPerOrder ? (
            <Field className="max-w-xs">
              <Input
                size="lg"
                type="number"
                inputMode="numeric"
                min={1}
                aria-label={copy.maxUses}
                value={form.maxUsesPerOrder}
                onChange={(e) => onChange({ maxUsesPerOrder: e.target.value })}
              />
            </Field>
          ) : null}
        </FieldGroup>
      </DataCard>
    </>
  )
}
