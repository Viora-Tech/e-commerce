'use client'

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@commerce/ui/shadcn/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@commerce/ui/shadcn/input-group'
import { RadioGroup } from '@commerce/ui/shadcn/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import RadioOption from '@/components/fields/radio-option'
import { marketsContent } from '@/data/markets'
import { useCopy } from '@/hooks/use-copy'
import type { MarketForm } from './market-form'

type PricingPatch = Partial<Pick<MarketForm, 'adjustment' | 'rounding' | 'rate' | 'duties'>>

type MarketPricingFieldsProps = {
  form: Pick<MarketForm, 'adjustment' | 'rounding' | 'rate' | 'duties' | 'currency'>
  /** The store's own currency, which prices are converted from (INR). */
  storeCurrency: string
  adjustmentError: string | undefined
  rateError: string | undefined
  onChange: (patch: PricingPatch) => void
}

const ROUNDINGS: MarketForm['rounding'][] = ['none', 'whole', 'x99']

/** How converted prices come out: a percent up or down, rounding, an optional fixed rate, duties. */
export default function MarketPricingFields({
  form,
  storeCurrency,
  adjustmentError,
  rateError,
  onChange,
}: MarketPricingFieldsProps) {
  // Hooks
  const copy = useCopy(marketsContent)

  // Render logic
  const text = copy.dialog.pricing
  const duties = copy.dialog.duties

  return (
    <>
      <FieldSet className="gap-3">
        <FieldLegend variant="label">{text.heading}</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={adjustmentError ? true : undefined}>
            <FieldLabel htmlFor="market-adjustment">{text.adjustment}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="market-adjustment"
                inputMode="decimal"
                value={form.adjustment}
                aria-invalid={adjustmentError ? true : undefined}
                onChange={(e) => onChange({ adjustment: e.target.value })}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>%</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="market-rounding">{text.rounding}</FieldLabel>
            <Select
              value={form.rounding}
              onValueChange={(v) => v && onChange({ rounding: v as MarketForm['rounding'] })}
            >
              <SelectTrigger id="market-rounding" className="w-full">
                <SelectValue>{text.roundings[form.rounding]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ROUNDINGS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {text.roundings[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <FieldDescription>{text.adjustmentHelp}</FieldDescription>
        {adjustmentError ? <FieldError>{adjustmentError}</FieldError> : null}
      </FieldSet>
      <Field data-invalid={rateError ? true : undefined}>
        <FieldLabel htmlFor="market-rate">{text.rate}</FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <InputGroupText>{text.ratePrefix(storeCurrency)}</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            id="market-rate"
            inputMode="decimal"
            value={form.rate}
            autoComplete="off"
            aria-invalid={rateError ? true : undefined}
            onChange={(e) => onChange({ rate: e.target.value })}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupText>{form.currency}</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
        <FieldDescription>{text.rateHelp}</FieldDescription>
        {rateError ? <FieldError>{rateError}</FieldError> : null}
      </Field>
      <FieldSet className="gap-3">
        <FieldLegend variant="label">{duties.label}</FieldLegend>
        <RadioGroup
          value={form.duties}
          onValueChange={(v) => onChange({ duties: v as MarketForm['duties'] })}
          className="gap-2"
        >
          <RadioOption
            id="market-duties-dap"
            value="dap"
            label={duties.dap}
            help={duties.dapHelp}
          />
          <RadioOption
            id="market-duties-ddp"
            value="ddp"
            label={duties.ddp}
            help={duties.ddpHelp}
          />
        </RadioGroup>
      </FieldSet>
    </>
  )
}
