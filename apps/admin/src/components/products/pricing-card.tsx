'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import MoneyInput from '@/components/fields/money-input'
import { productFormContent } from '@/data/products'
import { formatPaise } from '@/lib/money'
import { margin, type VariantRow } from './form-state'

type PricingCardProps = {
  variant: VariantRow
  onChange: (patch: Partial<VariantRow>) => void
}

const copy = productFormContent.pricing

/** Shown for single-variant products; the variants table carries these fields otherwise. */
export default function PricingCard({ variant, onChange }: PricingCardProps) {
  const m = margin(variant.price, variant.cost)

  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="variant-price">
                {copy.price}
                <span aria-hidden="true">*</span>
              </FieldLabel>
              <MoneyInput
                size="lg"
                id="variant-price"
                value={variant.price}
                onChange={(price) => onChange({ price })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="variant-mrp">{copy.mrp}</FieldLabel>
              <MoneyInput
                size="lg"
                id="variant-mrp"
                value={variant.mrp}
                onChange={(mrp) => onChange({ mrp })}
              />
            </Field>
          </div>
          <Field orientation="horizontal">
            <Checkbox
              id="variant-taxable"
              checked={variant.taxable}
              onCheckedChange={(taxable) => onChange({ taxable: Boolean(taxable) })}
            />
            <FieldLabel htmlFor="variant-taxable" className="font-normal">
              {copy.taxable}
            </FieldLabel>
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="variant-cost">{copy.cost}</FieldLabel>
              <MoneyInput
                size="lg"
                id="variant-cost"
                value={variant.cost}
                onChange={(cost) => onChange({ cost })}
              />
              <FieldDescription>
                {m ? copy.margin(`${m.pct}%`, formatPaise(m.profitPaise)) : copy.costHelp}
              </FieldDescription>
            </Field>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
