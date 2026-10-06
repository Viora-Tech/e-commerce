'use client'

import type { CSSProperties } from 'react'
import SuggestInput from '@/components/fields/suggest-input'
import TagInput from '@/components/fields/tag-input'
import KitField from '@/components/kit/kit-field'
import DataCard from '@/components/layout/data-card'
import { productFormContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'
import type { Facets } from './form-state'
import ProductCategoryPicker from './product-category-picker'

type ProductCategoriesCardProps = {
  categoryId: string | null
  productType: string
  tags: string[]
  /** Values of the colour option, when the product has one. */
  colours: string[]
  facets: Facets
  onCategoryId: (categoryId: string | null) => void
  onProductType: (value: string) => void
  onTags: (tags: string[]) => void
}

/** Named colours we can show as a swatch; anything else falls back to a labelled chip. */
const SWATCHES: Record<string, string> = {
  black: '#464a4d',
  white: '#f5f5f4',
  grey: '#d5dde0',
  gray: '#d5dde0',
  silver: '#d5dde0',
  red: '#ecd3d6',
  pink: '#ecd3d6',
  purple: '#ded3ec',
  violet: '#ded3ec',
  blue: '#d3dfec',
  green: '#d7eacb',
  yellow: '#ece7c9',
  cream: '#ece7c9',
  beige: '#ece7c9',
  orange: '#ecdccb',
  brown: '#e0d3c6',
}

function swatchFor(value: string): string | null {
  const key = value.trim().toLowerCase()
  const direct = SWATCHES[key]
  if (direct) return direct
  const word = Object.keys(SWATCHES).find((name) => key.includes(name))
  return word ? (SWATCHES[word] ?? null) : null
}

/** Frame 5:5233: product category and tag pickers over the colour swatch row. */
export default function ProductCategoriesCard({
  categoryId,
  productType,
  tags,
  colours,
  facets,
  onCategoryId,
  onProductType,
  onTags,
}: ProductCategoriesCardProps) {
  // Hooks
  const formCopy = useCopy(productFormContent)
  const copy = formCopy.categories

  // Render logic
  return (
    <DataCard title={copy.heading}>
      <div className="flex flex-col gap-4">
        <KitField label={copy.category} htmlFor="product-category" help={copy.categoryHelp}>
          <ProductCategoryPicker id="product-category" value={categoryId} onChange={onCategoryId} />
        </KitField>
        <KitField label={copy.type} htmlFor="product-type">
          <SuggestInput
            id="product-type"
            size="kit"
            value={productType}
            suggestions={facets.productTypes}
            placeholder={copy.typePlaceholder}
            onChange={onProductType}
          />
        </KitField>
        <KitField label={copy.tag} htmlFor="product-tags">
          <TagInput
            id="product-tags"
            tags={tags}
            suggestions={facets.tags}
            onChange={onTags}
            placeholder={formCopy.organisation.tagsPlaceholder}
          />
        </KitField>
        {colours.length ? (
          <KitField label={copy.colour} help={copy.colourHelp}>
            <ul className="flex flex-wrap gap-2">
              {colours.map((colour) => {
                const swatch = swatchFor(colour)
                return (
                  <li key={colour}>
                    {swatch ? (
                      <span
                        title={colour}
                        style={{ '--swatch': swatch } as CSSProperties}
                        className="block size-8 rounded-md bg-(color:--swatch) ring-1 ring-border ring-inset"
                      >
                        <span className="sr-only">{colour}</span>
                      </span>
                    ) : (
                      <span className="flex h-8 items-center rounded-md border border-border px-2.5 text-caption text-muted-foreground">
                        {colour}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </KitField>
        ) : null}
      </div>
    </DataCard>
  )
}
