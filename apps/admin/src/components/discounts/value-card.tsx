'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { Switch } from '@commerce/ui/shadcn/switch'
import MoneyInput from '@/components/fields/money-input'
import { discountFormContent } from '@/data/discounts'
import { type DiscountFormState, usesPerProduct, validAmount } from './form-state'
import ProductPicker from './product-picker'

type ValueCardProps = {
  form: Pick<
    DiscountFormState,
    'method' | 'value' | 'appliesTo' | 'productIds' | 'perProduct' | 'productValues'
  >
  valueError?: string | undefined
  productsError?: string | undefined
  productValuesError?: string | undefined
  onChange: (patch: Partial<DiscountFormState>) => void
}

const copy = discountFormContent.value

export default function ValueCard({
  form,
  valueError,
  productsError,
  productValuesError,
  onChange,
}: ValueCardProps) {
  // Helpers
  const setProductValue = (id: string, value: string) =>
    onChange({ productValues: { ...form.productValues, [id]: value } })

  // Render logic
  const isPercent = form.method === 'percent'
  const perProduct = usesPerProduct(form)
  const needsValue = form.method !== 'free_shipping' && !perProduct
  const canSplit = form.appliesTo === 'products' && form.method !== 'free_shipping'
  const rowExtra = perProduct
    ? (p: { id: string; title: string }) => (
        <MoneyInput
          value={form.productValues[p.id] ?? ''}
          onChange={(value) => setProductValue(p.id, value)}
          currency={!isPercent}
          suffix={isPercent ? '%' : undefined}
          aria-label={isPercent ? copy.percentFor(p.title) : copy.amountFor(p.title)}
          invalid={
            productValuesError && !validAmount(form.method, form.productValues[p.id])
              ? true
              : undefined
          }
        />
      )
    : undefined

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
                {canSplit ? (
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldLabel htmlFor="discount-per-product" className="font-normal">
                        {copy.perProduct}
                      </FieldLabel>
                      {perProduct ? (
                        <FieldDescription>{copy.perProductHelp}</FieldDescription>
                      ) : null}
                    </FieldContent>
                    <Switch
                      id="discount-per-product"
                      checked={form.perProduct}
                      onCheckedChange={(on) => onChange({ perProduct: on })}
                    />
                  </Field>
                ) : null}
                <ProductPicker
                  selected={form.productIds}
                  onChange={(productIds) => onChange({ productIds })}
                  rowExtra={rowExtra}
                />
                {productsError ? <FieldError>{productsError}</FieldError> : null}
                {productValuesError ? <FieldError>{productValuesError}</FieldError> : null}
              </>
            ) : null}
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
