'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import MoneyInput from '@/components/fields/money-input'
import { COUNTRIES } from '@/data/countries'
import { productFormContent } from '@/data/products'
import type { VariantRow } from './form-state'

type ShippingCardProps = {
  variant: VariantRow
  onChange: (patch: Partial<VariantRow>) => void
}

const copy = productFormContent.shipping
const NONE = '__none'

/** Weight and the customs fields couriers ask for on international labels. */
export default function ShippingCard({ variant, onChange }: ShippingCardProps) {
  // Render logic
  const items = Object.fromEntries([
    [NONE, copy.countryPlaceholder],
    ...COUNTRIES.map((c) => [c.code, c.name]),
  ])

  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="variant-weight">{copy.weight}</FieldLabel>
              <MoneyInput
                size="lg"
                id="variant-weight"
                currency={false}
                suffix="g"
                value={variant.weight}
                onChange={(weight) => onChange({ weight })}
              />
              <FieldDescription>{copy.weightHelp}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="variant-hs">{copy.hsCode}</FieldLabel>
              <Input
                size="lg"
                id="variant-hs"
                value={variant.hsCode}
                onChange={(e) => onChange({ hsCode: e.target.value })}
                autoComplete="off"
                inputMode="numeric"
              />
              <FieldDescription>{copy.hsCodeHelp}</FieldDescription>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="variant-origin">{copy.country}</FieldLabel>
            <Select
              items={items}
              value={variant.countryOfOrigin || NONE}
              onValueChange={(next) =>
                onChange({ countryOfOrigin: next === NONE ? '' : String(next) })
              }
            >
              <SelectTrigger size="lg" id="variant-origin" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{copy.countryPlaceholder}</SelectItem>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{copy.countryHelp}</FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
