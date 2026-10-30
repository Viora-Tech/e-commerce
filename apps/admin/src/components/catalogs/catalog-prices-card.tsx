'use client'

import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
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

/** The catalog's price change: a percent up or down, and fixed prices per variant. */
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

  // Early returns
  if (rupeeLocked) {
    return (
      <DataCard title={copy.prices}>
        <Alert>
          <AlertDescription>{copy.rupeeOnly}</AlertDescription>
        </Alert>
      </DataCard>
    )
  }

  return (
    <DataCard title={copy.prices} subtitle={copy.pricesHelp}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="catalog-percent">{copy.adjustLabel}</FieldLabel>
          <div className="flex max-w-md gap-2">
            <NativeSelect
              aria-label={copy.adjustLabel}
              className="w-36"
              value={form.direction}
              disabled={disabled}
              onChange={(e) => onChange({ direction: e.target.value === 'down' ? 'down' : 'up' })}
            >
              <NativeSelectOption value="up">{copy.direction.up}</NativeSelectOption>
              <NativeSelectOption value="down">{copy.direction.down}</NativeSelectOption>
            </NativeSelect>
            <div className="relative w-32">
              <Input
                id="catalog-percent"
                inputMode="decimal"
                aria-label={copy.percent}
                className="pr-7"
                value={form.percent}
                disabled={disabled}
                onChange={(e) => onChange({ percent: e.target.value })}
              />
              <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 text-body text-muted-foreground">
                %
              </span>
            </div>
          </div>
        </Field>
        <Field>
          <FieldLabel>{copy.fixedTitle}</FieldLabel>
          {currency ? (
            <>
              <FieldDescription>{copy.fixedHelp(currency)}</FieldDescription>
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
            <FieldDescription>{copy.fixedNeedsMarket}</FieldDescription>
          )}
        </Field>
      </FieldGroup>
    </DataCard>
  )
}
