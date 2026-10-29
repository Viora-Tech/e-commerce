'use client'

import { TrendingUp } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import MoneyInput from '@/components/fields/money-input'
import KitField from '@/components/kit/kit-field'
import ChoiceCard from '@/components/layout/choice-card'
import { productFormContent } from '@/data/product-form'
import { rupees } from '@/data/products'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { type Facets, margin, type VariantRow } from './form-state'

type ProductPricingSectionProps = {
  variant: VariantRow
  /** Store GST defaults; without them a blank variant rate shows no breakdown. */
  gst?: Facets['gst'] | undefined
  taxIncluded: boolean
  saleStartsAt: string
  saleEndsAt: string
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

  const profit = margin(variant.price, variant.cost)
  const ownRate = variant.gstRate.trim() === '' ? null : Number(variant.gstRate)
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
        <KitField label={copy.price} htmlFor="variant-price" help={copy.priceHelp}>
          <MoneyInput
            size="kit"
            id="variant-price"
            value={variant.price}
            onChange={(price) => onVariant({ price })}
          />
        </KitField>
        <KitField
          label={`${copy.mrp} ${copy.mrpOptional}`}
          htmlFor="variant-mrp"
          help={mrpBelow ? copy.mrpBelowPrice : saving ? copy.saving(fmt.money(saving)) : undefined}
        >
          <MoneyInput
            size="kit"
            id="variant-mrp"
            value={variant.mrp}
            onChange={(mrp) => onVariant({ mrp })}
          />
        </KitField>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <KitField label={copy.cost} htmlFor="variant-cost" help={copy.costHelp}>
          <MoneyInput
            size="kit"
            id="variant-cost"
            value={variant.cost}
            onChange={(cost) => onVariant({ cost })}
          />
        </KitField>
      </div>

      {profit ? (
        <p className="flex items-center gap-2 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-body text-success">
          <TrendingUp className="size-4 shrink-0" aria-hidden="true" />
          {copy.margin(`${profit.pct}%`, fmt.money(profit.profitPaise))}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 border-border border-t pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <label htmlFor="variant-taxable" className="text-body text-foreground">
              {copy.taxable}
            </label>
            <p className="text-caption text-muted-foreground">{copy.taxableHelp}</p>
            {taxLine ? (
              <p className="text-caption text-ink-strong tabular-nums" aria-live="polite">
                {taxLine}
              </p>
            ) : null}
          </div>
          <Switch
            id="variant-taxable"
            checked={variant.taxable}
            onCheckedChange={(taxable) => onVariant({ taxable })}
          />
        </div>
        {variant.taxable ? (
          <KitField label={copy.taxIncluded} help={copy.taxIncludedHelp}>
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
          </KitField>
        ) : null}
      </div>

      <KitField label={copy.expiration} help={copy.expirationHelp}>
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex flex-col gap-1.5 md:flex-1">
            <label htmlFor="sale-starts-at" className="text-caption text-muted-foreground">
              {copy.expirationStart}
            </label>
            <Input
              id="sale-starts-at"
              size="kit"
              type="date"
              value={saleStartsAt}
              onChange={(e) => onSaleStartsAt(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5 md:flex-1">
            <label htmlFor="sale-ends-at" className="text-caption text-muted-foreground">
              {copy.expirationEnd}
            </label>
            <Input
              id="sale-ends-at"
              size="kit"
              type="date"
              value={saleEndsAt}
              onChange={(e) => onSaleEndsAt(e.target.value)}
            />
          </div>
        </div>
      </KitField>
    </div>
  )
}
