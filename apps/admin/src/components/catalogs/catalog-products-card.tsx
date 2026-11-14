'use client'

import type { CatalogView } from '@commerce/core'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
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
        <Field orientation="horizontal" className="items-start gap-3">
          <Switch
            id="catalog-auto-include"
            className="mt-0.5"
            checked={scope === 'all'}
            disabled={disabled}
            onCheckedChange={(on) => onChange({ scope: on ? 'all' : 'chosen' })}
          />
          <FieldContent className="gap-0">
            <FieldLabel
              htmlFor="catalog-auto-include"
              className="text-body leading-5 text-ink-strong"
            >
              {copy.autoInclude}
            </FieldLabel>
            <FieldDescription>
              {scope === 'all' ? copy.autoIncludeHelp : copy.scopeHelp.chosen}
            </FieldDescription>
          </FieldContent>
        </Field>
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
