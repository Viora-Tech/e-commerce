'use client'

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { RadioGroup } from '@commerce/ui/shadcn/radio-group'
import { Switch } from '@commerce/ui/shadcn/switch'
import MoneyInput from '@/components/fields/money-input'
import RadioOption from '@/components/fields/radio-option'
import RequiredMark from '@/components/fields/required-mark'
import DataCard from '@/components/layout/data-card'
import { discountFormContent } from '@/data/discounts'
import { useCopy } from '@/hooks/use-copy'
import AppliesToPicker from './applies-to-picker'
import { type DiscountFormState, usesPerProduct, validAmount } from './form-state'

type ValueCardProps = {
  form: Pick<
    DiscountFormState,
    | 'method'
    | 'value'
    | 'appliesTo'
    | 'productIds'
    | 'collectionIds'
    | 'perProduct'
    | 'productValues'
  >
  valueError?: string | undefined
  productsError?: string | undefined
  productValuesError?: string | undefined
  onChange: (patch: Partial<DiscountFormState>) => void
}

export default function ValueCard({
  form,
  valueError,
  productsError,
  productValuesError,
  onChange,
}: ValueCardProps) {
  // Hooks
  const { value: copy } = useCopy(discountFormContent)

  // Helpers
  const setProductValue = (id: string, value: string) =>
    onChange({ productValues: { ...form.productValues, [id]: value } })

  // Event handlers
  const handlePicked = ({ kind, ids }: { kind: 'products' | 'collections'; ids: string[] }) =>
    onChange(
      kind === 'collections'
        ? { appliesTo: kind, collectionIds: ids }
        : { appliesTo: kind, productIds: ids },
    )

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
    <DataCard title={copy.heading}>
      <FieldGroup>
        {needsValue ? (
          <Field data-invalid={valueError ? true : undefined} className="max-w-xs">
            <FieldLabel htmlFor="discount-value">
              {isPercent ? copy.percent : copy.amount}
              <RequiredMark />
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
            <RadioOption id="applies-all" value="all" label={copy.all} />
            <RadioOption id="applies-collections" value="collections" label={copy.collections} />
            <RadioOption id="applies-products" value="products" label={copy.products} />
          </RadioGroup>
          {form.appliesTo !== 'all' ? (
            <>
              <FieldDescription>
                {form.appliesTo === 'collections' ? copy.collectionsHelp : copy.productsHelp}
              </FieldDescription>
              {canSplit ? (
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="discount-per-product" className="font-normal">
                      {copy.perProduct}
                    </FieldLabel>
                    {perProduct ? <FieldDescription>{copy.perProductHelp}</FieldDescription> : null}
                  </FieldContent>
                  <Switch
                    id="discount-per-product"
                    checked={form.perProduct}
                    onCheckedChange={(on) => onChange({ perProduct: on })}
                  />
                </Field>
              ) : null}
              <AppliesToPicker
                kind={form.appliesTo}
                ids={form.appliesTo === 'collections' ? form.collectionIds : form.productIds}
                onChange={handlePicked}
                rowExtra={form.appliesTo === 'products' ? rowExtra : undefined}
              />
              {productsError ? <FieldError>{productsError}</FieldError> : null}
              {productValuesError ? <FieldError>{productValuesError}</FieldError> : null}
            </>
          ) : null}
        </Field>
      </FieldGroup>
    </DataCard>
  )
}
