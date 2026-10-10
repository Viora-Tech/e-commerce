'use client'

import { type PurchaseCurrency, parseFxRate } from '@commerce/core/inventory'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import CurrencySelect from '@/components/landed-cost/currency-select'
import { poCurrencyContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'

type CurrencyCardProps = {
  currency: PurchaseCurrency
  fxRate: string
  /** The currency is fixed once ordered; the rate can still be corrected. */
  currencyLocked: boolean
  disabled: boolean
  onChange: (patch: { currency?: PurchaseCurrency; fxRate?: string }) => void
}

/** What the supplier bills in, and the rupee rate every price on the order converts at. */
export default function CurrencyCard({
  currency,
  fxRate,
  currencyLocked,
  disabled,
  onChange,
}: CurrencyCardProps) {
  // Hooks
  const copy = useCopy(poCurrencyContent)

  // Render logic
  const badRate = currency !== 'INR' && fxRate.trim() !== '' && parseFxRate(fxRate) === null

  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="po-currency">{copy.currency}</FieldLabel>
            <CurrencySelect
              id="po-currency"
              value={currency}
              disabled={disabled || currencyLocked}
              onChange={(next) => onChange({ currency: next, fxRate: next === 'INR' ? '1' : '' })}
              className="w-full"
            />
            {currencyLocked ? <FieldDescription>{copy.locked}</FieldDescription> : null}
          </Field>
          {currency === 'INR' ? null : (
            <Field data-invalid={badRate || undefined}>
              <FieldLabel htmlFor="po-fx">{copy.fxRate}</FieldLabel>
              <Input
                id="po-fx"
                value={fxRate}
                inputMode="decimal"
                placeholder="83.25"
                disabled={disabled}
                aria-invalid={badRate || undefined}
                className="tabular-nums"
                onChange={(e) => onChange({ fxRate: e.target.value })}
              />
              <FieldDescription>{badRate ? copy.badRate : copy.fxHint(currency)}</FieldDescription>
            </Field>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
