'use client'

import { TrendingUp } from '@commerce/ui/icons'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import DateField from '@/components/fields/date-field'
import MoneyInput from '@/components/fields/money-input'
import SwitchRow from '@/components/fields/switch-row'
import ChoiceCard from '@/components/layout/choice-card'
import { productFormContent } from '@/data/product-form'
import { rupees } from '@/data/products'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { type Facets, margin, type VariantRow } from './form-state'
import { type ProductTax, variantTax } from './product-tax'
import ProductTaxFields from './product-tax-fields'
import ZeroPriceWarning from './zero-price-warning'

type ProductPricingSectionProps = {
  variant: VariantRow
  /** Store GST defaults; without them a blank variant rate shows no breakdown. */
  gst?: Facets['gst'] | undefined
  taxIncluded: boolean
  saleStartsAt: string
  saleEndsAt: string
  /** The product's GST rate, edited under "Charge tax" (audit #135). */
  tax: ProductTax
  onTax: (tax: ProductTax) => void
  onVariant: (patch: Partial<VariantRow>) => void
  onTaxIncluded: (value: boolean) => void
  onSaleStartsAt: (value: string) => void
  onSaleEndsAt: (value: string) => void
}

/** Rupees saved against the compare-at price, or null when there is nothing to show. */
function savingPaise(price: string, mrp: string): number | null {
  const p = rupees.toPaise(price)
  const m = rupees.toPaise(mrp)
  if (p == null || m == null || m <= p) return null
  return m - p
}

/**
 * What the customer pays and what the store keeps, in paise, at `ratePercent`. Null when the
 * price is not a number yet.
 */
function gstSplit(price: string, ratePercent: number, taxIncluded: boolean) {
  const p = rupees.toPaise(price)
  if (p == null) return null
  const excl = taxIncluded ? Math.round((p * 100) / (100 + ratePercent)) : p
  const incl = taxIncluded ? p : Math.round((p * (100 + ratePercent)) / 100)
  return { incl, excl, gst: incl - excl }
}

/**
 * Frame 5:5166, 5:5134 and 5:5154: full-width price with a currency plate,
 * then compare-at beside the tax choice, then the two date fields.
 */
export default function ProductPricingSection({
  variant,
  gst,
  taxIncluded,
  saleStartsAt,
  saleEndsAt,
  tax,
  onTax,
  onVariant,
  onTaxIncluded,
  onSaleStartsAt,
  onSaleEndsAt,
}: ProductPricingSectionProps) {
  // Hooks
  const { pricing: copy } = useCopy(productFormContent)
  const fmt = useFormat()

  // Render logic
  const saving = savingPaise(variant.price, variant.mrp)
  const mrpBelow =
    rupees.toPaise(variant.mrp) != null &&
    rupees.toPaise(variant.price) != null &&
    saving === null &&
    variant.mrp.trim() !== ''
  const mrpHelp = mrpBelow ? copy.mrpBelowPrice : saving ? copy.saving(fmt.money(saving)) : null

  const profit = margin(variant.price, variant.cost)
  const billedRate = variantTax(tax, variant).gstRate
  const ownRate = billedRate === '' ? null : Number(billedRate)
  // Under the composition scheme no GST is charged, whatever the rate says.
  const rate = gst?.composition ? 0 : (ownRate ?? gst?.ratePercent ?? null)
  const pricePaise = rupees.toPaise(variant.price)
  const split = variant.taxable && rate ? gstSplit(variant.price, rate, taxIncluded) : null
  const taxLine = split
    ? copy.gstBreakdown(
        fmt.money(split.incl),
        fmt.money(split.excl),
        fmt.money(split.gst),
        rate ?? 0,
      )
    : pricePaise != null && (!variant.taxable || rate === 0)
      ? copy.noGst(fmt.money(pricePaise))
      : null

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="variant-price">{copy.price}</FieldLabel>
          <MoneyInput
            size="kit"
            id="variant-price"
            value={variant.price}
            onChange={(price) => onVariant({ price })}
          />
          <ZeroPriceWarning variant={variant} />
          <FieldDescription>{copy.priceHelp}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="variant-mrp">{`${copy.mrp} ${copy.mrpOptional}`}</FieldLabel>
          <MoneyInput
            size="kit"
            id="variant-mrp"
            value={variant.mrp}
            onChange={(mrp) => onVariant({ mrp })}
          />
          {mrpHelp ? <FieldDescription>{mrpHelp}</FieldDescription> : null}
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="variant-cost">{copy.cost}</FieldLabel>
          <MoneyInput
            size="kit"
            id="variant-cost"
            value={variant.cost}
            onChange={(cost) => onVariant({ cost })}
          />
          <FieldDescription>{copy.costHelp}</FieldDescription>
        </Field>
      </div>

      {profit ? (
        <Alert tone="success">
          <TrendingUp aria-hidden="true" />
          <AlertDescription className="text-body text-foreground">
            {copy.margin(`${profit.pct}%`, fmt.money(profit.profitPaise))}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 border-border border-t pt-4">
        <SwitchRow
          id="variant-taxable"
          label={copy.taxable}
          description={copy.taxableHelp}
          checked={variant.taxable}
          onChange={(taxable) => onVariant({ taxable })}
          weight="normal"
        >
          {taxLine ? (
            <p className="text-caption text-ink-strong tabular-nums" aria-live="polite">
              {taxLine}
            </p>
          ) : null}
        </SwitchRow>
        {variant.taxable ? (
          <ProductTaxFields tax={tax} singleVariant part="rate" onChange={onTax} />
        ) : null}
        {variant.taxable ? (
          <Field>
            <FieldLabel>{copy.taxIncluded}</FieldLabel>
            <div className="grid gap-2 md:grid-cols-2">
              <ChoiceCard
                layout="row"
                showCheck
                label={copy.taxIncludedYes}
                selected={taxIncluded}
                onSelect={() => onTaxIncluded(true)}
              />
              <ChoiceCard
                layout="row"
                showCheck
                label={copy.taxIncludedNo}
                selected={!taxIncluded}
                onSelect={() => onTaxIncluded(false)}
              />
            </div>
            <FieldDescription>{copy.taxIncludedHelp}</FieldDescription>
          </Field>
        ) : null}
      </div>

      <Field>
        <FieldLabel>{copy.expiration}</FieldLabel>
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex flex-col gap-1.5 md:flex-1">
            <FieldLabel htmlFor="sale-starts-at">{copy.expirationStart}</FieldLabel>
            <DateField
              id="sale-starts-at"
              value={saleStartsAt}
              onChange={(v) => onSaleStartsAt(v)}
            />
          </div>
          <div className="flex flex-col gap-1.5 md:flex-1">
            <FieldLabel htmlFor="sale-ends-at">{copy.expirationEnd}</FieldLabel>
            <DateField id="sale-ends-at" value={saleEndsAt} onChange={(v) => onSaleEndsAt(v)} />
          </div>
        </div>
        <FieldDescription>{copy.expirationHelp}</FieldDescription>
      </Field>
    </div>
  )
}
