'use client'

import type { CatalogView } from '@commerce/core'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { RadioGroup } from '@commerce/ui/shadcn/radio-group'
import DataCard from '@/components/layout/data-card'
import PickedField from '@/components/pickers/picked-field'
import RolloutOption from '@/components/rollouts/rollout-option'
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

const SCOPES = ['all', 'chosen'] as const

/** What the catalog sells: every product, or the products and collections chosen here. */
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
        <RadioGroup
          value={scope}
          disabled={disabled}
          onValueChange={(v) => onChange({ scope: v === 'chosen' ? 'chosen' : 'all' })}
        >
          {SCOPES.map((s) => (
            <RolloutOption
              key={s}
              id={`catalog-scope-${s}`}
              value={s}
              label={copy.scope[s]}
              help={copy.scopeHelp[s]}
            />
          ))}
        </RadioGroup>
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
