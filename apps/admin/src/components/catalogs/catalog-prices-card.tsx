'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import type { ReactNode } from 'react'
import DataCard from '@/components/layout/data-card'
import PickedField from '@/components/pickers/picked-field'
import { catalogsContent } from '@/data/catalogs'
import { useCopy } from '@/hooks/use-copy'
import type { CatalogFormState, FixedPriceDraft } from './catalog-form-state'
import { catalogTab } from './catalog-pick-sources'

type CatalogPricesCardProps = {
  form: Pick<CatalogFormState, 'percent' | 'direction' | 'prices'>
  /** The currency fixed prices are typed in: the first market abroad picked; null without one. */
  currency: string | null
  /** A rupee market uses the catalog: its prices stay the products' own. */
  rupeeLocked: boolean
  disabled: boolean
  onChange: (patch: Partial<CatalogFormState>) => void
}

type PriceRowProps = { label: string; htmlFor?: string; children: ReactNode }

/** The store's own currency: rupee markets charge the products' own prices in it. */
const STORE_CURRENCY = 'INR'

/**
 * The catalog's pricing, as Shopify's card: which currency prices are set in, the overall
 * adjustment (a percent, up or down) and price overrides per variant.
 */
export default function CatalogPricesCard({
  form,
  currency,
  rupeeLocked,
  disabled,
  onChange,
}: CatalogPricesCardProps) {
  // Hooks
  const { form: copy } = useCopy(catalogsContent)

  // Event handlers
  const handlePicked = (ids: string[]) =>
    onChange({
      prices: ids.map(
        (id): FixedPriceDraft =>
          form.prices.find((p) => p.variantId === id) ?? {
            variantId: id,
            amount: '',
            item: { id, title: '' },
          },
      ),
    })
  const handleAmount = (variantId: string, amount: string) =>
    onChange({
      prices: form.prices.map((p) => (p.variantId === variantId ? { ...p, amount } : p)),
    })

  // Render logic
  const pricesIn =
    currency && !rupeeLocked ? copy.marketCurrency(currency) : copy.storeCurrency(STORE_CURRENCY)

  return (
    <DataCard title={copy.pricing} subtitle={rupeeLocked ? undefined : copy.pricesHelp}>
      <div className="divide-y divide-border rounded-lg border border-border">
        <PriceRow label={copy.setPricesIn}>
          <p className="pt-1.5 text-body text-ink-strong">{pricesIn}</p>
          {rupeeLocked ? (
            <p className="text-caption text-muted-foreground">{copy.rupeeOnly}</p>
          ) : null}
        </PriceRow>
        {rupeeLocked ? null : (
          <>
            <PriceRow label={copy.adjustLabel} htmlFor="catalog-percent">
              <div className="flex flex-wrap gap-2">
                <div className="relative w-28">
                  <Input
                    id="catalog-percent"
                    inputMode="decimal"
                    className="pr-7"
                    value={form.percent}
                    disabled={disabled}
                    onChange={(e) => onChange({ percent: e.target.value })}
                  />
                  <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 text-body text-muted-foreground">
                    %
                  </span>
                </div>
                <NativeSelect
                  aria-label={copy.adjustLabel}
                  className="w-36"
                  value={form.direction}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange({ direction: e.target.value === 'down' ? 'down' : 'up' })
                  }
                >
                  <NativeSelectOption value="up">{copy.direction.up}</NativeSelectOption>
                  <NativeSelectOption value="down">{copy.direction.down}</NativeSelectOption>
                </NativeSelect>
              </div>
            </PriceRow>
            <PriceRow label={copy.overrides}>
              {currency ? (
                <>
                  <p className="pt-1.5 text-caption text-muted-foreground">
                    {copy.fixedHelp(currency)}
                  </p>
                  <PickedField
                    kind="variants"
                    ids={form.prices.map((p) => p.variantId)}
                    tabs={[catalogTab('variants', copy)]}
                    title={copy.pickVariants}
                    search={copy.searchVariants}
                    labels={copy}
                    loadPicked={async (_, ids) =>
                      form.prices
                        .filter((p) => ids.includes(p.variantId) && p.item.title)
                        .map((p) => p.item)
                    }
                    onChange={(next) => handlePicked(next.ids)}
                    rowExtra={(item) => (
                      <Input
                        inputMode="decimal"
                        aria-label={copy.amount(currency)}
                        placeholder={currency}
                        value={form.prices.find((p) => p.variantId === item.id)?.amount ?? ''}
                        disabled={disabled}
                        onChange={(e) => handleAmount(item.id, e.target.value)}
                      />
                    )}
                  />
                </>
              ) : (
                <p className="pt-1.5 text-caption text-muted-foreground">{copy.fixedNeedsMarket}</p>
              )}
            </PriceRow>
          </>
        )}
      </div>
    </DataCard>
  )
}

/** One Shopify-style row: the label on the left, its control on the right. */
function PriceRow({ label, htmlFor, children }: PriceRowProps) {
  return (
    <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
      <label
        htmlFor={htmlFor}
        className="w-40 shrink-0 pt-1.5 text-body font-medium text-ink-strong"
      >
        {label}
      </label>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">{children}</div>
    </div>
  )
}
