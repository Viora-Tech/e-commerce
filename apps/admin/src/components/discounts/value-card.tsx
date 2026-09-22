'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import MoneyInput from '@/components/fields/money-input'
import { discountFormContent } from '@/data/discounts'
import type { DiscountFormState } from './form-state'
import ProductPicker from './product-picker'

type ValueCardProps = {
  form: Pick<DiscountFormState, 'method' | 'value' | 'appliesTo' | 'productIds'>
  valueError?: string | undefined
  productsError?: string | undefined
  onChange: (patch: Partial<DiscountFormState>) => void
}

const copy = discountFormContent.value

export default function ValueCard({ form, valueError, productsError, onChange }: ValueCardProps) {
  // Render logic
  const isPercent = form.method === 'percent'
  const needsValue = form.method !== 'free_shipping'

  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {needsValue ? (
            <Field data-invalid={valueError ? true : undefined} className="max-w-xs">
              <FieldLabel htmlFor="discount-value">
                {isPercent ? copy.percent : copy.amount}
                <span aria-hidden="true">*</span>
              </FieldLabel>
              <MoneyInput
                size="lg"
                id="discount-value"
                value={form.value}
                onChange={(value) => onChange({ value })}
                currency={!isPercent}
                suffix={isPercent ? '%' : undefined}
                invalid={valueError ? true : undefined}
              />
              {valueError ? <FieldError>{valueError}</FieldError> : null}
            </Field>
          ) : null}
          <Field data-invalid={productsError ? true : undefined}>
            <FieldLabel>{copy.appliesTo}</FieldLabel>
            <RadioGroup
              value={form.appliesTo}
              onValueChange={(v) => onChange({ appliesTo: v as DiscountFormState['appliesTo'] })}
              className="gap-2"
            >
              <FieldLabel htmlFor="applies-all" className="flex items-center gap-2 font-normal">
                <RadioGroupItem id="applies-all" value="all" />
                {copy.all}
              </FieldLabel>
              <FieldLabel
                htmlFor="applies-products"
                className="flex items-center gap-2 font-normal"
              >
                <RadioGroupItem id="applies-products" value="products" />
                {copy.products}
              </FieldLabel>
            </RadioGroup>
            {form.appliesTo === 'products' ? (
              <>
                <FieldDescription>{copy.productsHelp}</FieldDescription>
                <ProductPicker
                  selected={form.productIds}
                  onChange={(productIds) => onChange({ productIds })}
                />
                {productsError ? <FieldError>{productsError}</FieldError> : null}
              </>
            ) : null}
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
