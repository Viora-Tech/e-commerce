'use client'

import type { CatalogView } from '@commerce/core'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Switch } from '@commerce/ui/shadcn/switch'
import DataCard from '@/components/layout/data-card'
import PickedField from '@/components/pickers/picked-field'
import { catalogsContent } from '@/data/catalogs'
import { useCopy } from '@/hooks/use-copy'
import { catalogTab, loadCatalogPicked } from './catalog-pick-sources'

type CatalogScope = CatalogView['scope']

type CatalogProductsCardProps = {
  scope: CatalogScope
  productIds: string[]
  collectionIds: string[]
  disabled: boolean
  onChange: (patch: {
    scope?: CatalogScope
    productIds?: string[]
    collectionIds?: string[]
  }) => void
}

/**
 * What the catalog sells, as Shopify's card: "Automatically include all products" on, or off
 * with the products and collections chosen here.
 */
export default function CatalogProductsCard({
  scope,
  productIds,
  collectionIds,
  disabled,
  onChange,
}: CatalogProductsCardProps) {
  // Hooks
  const { form: copy } = useCopy(catalogsContent)

  return (
    <DataCard title={copy.products}>
      <FieldGroup>
        <label htmlFor="catalog-auto-include" className="flex items-start gap-3">
          <Switch
            id="catalog-auto-include"
            className="mt-0.5"
            checked={scope === 'all'}
            disabled={disabled}
            onCheckedChange={(on) => onChange({ scope: on ? 'all' : 'chosen' })}
          />
          <span className="flex min-w-0 flex-col">
            <span className="text-body font-medium text-ink-strong">{copy.autoInclude}</span>
            <span className="text-caption text-muted-foreground">
              {scope === 'all' ? copy.autoIncludeHelp : copy.scopeHelp.chosen}
            </span>
          </span>
        </label>
        {scope === 'chosen' ? (
          <>
            <Field>
              <FieldLabel>{copy.productsLabel}</FieldLabel>
              <PickedField
                kind="products"
                ids={productIds}
                tabs={[catalogTab('products', copy)]}
                title={copy.pickProducts}
                search={copy.searchProducts}
                labels={copy}
                loadPicked={(_, ids) => loadCatalogPicked('products', ids, copy)}
                onChange={(next) => onChange({ productIds: next.ids })}
              />
            </Field>
            <Field>
              <FieldLabel>{copy.collectionsLabel}</FieldLabel>
              <PickedField
                kind="collections"
                ids={collectionIds}
                tabs={[catalogTab('collections', copy)]}
                title={copy.pickCollections}
                search={copy.searchCollections}
                labels={copy}
                loadPicked={(_, ids) => loadCatalogPicked('collections', ids, copy)}
                onChange={(next) => onChange({ collectionIds: next.ids })}
              />
            </Field>
          </>
        ) : null}
      </FieldGroup>
    </DataCard>
  )
}
