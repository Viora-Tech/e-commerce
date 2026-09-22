'use client'

import { Card, CardContent } from '@commerce/ui/shadcn/card'
import SuggestInput from '@/components/fields/suggest-input'
import TagInput from '@/components/fields/tag-input'
import KitField from '@/components/kit/kit-field'
import { productFormContent } from '@/data/products'
import type { Facets } from './form-state'

type ProductCategoriesCardProps = {
  productType: string
  tags: string[]
  /** Values of the colour option, when the product has one. */
  colours: string[]
  facets: Facets
  onProductType: (value: string) => void
  onTags: (tags: string[]) => void
}

const copy = productFormContent.categories

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
  productType,
  tags,
  colours,
  facets,
  onProductType,
  onTags,
}: ProductCategoriesCardProps) {
  // Render logic
  return (
    <Card size="form" className="gap-6 p-6">
      <CardContent className="flex flex-col gap-6 p-0">
        <h2 className="text-kit-heading text-foreground">{copy.heading}</h2>
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
            placeholder={productFormContent.organisation.tagsPlaceholder}
          />
        </KitField>
        {colours.length ? (
          <KitField label={copy.colour} help={copy.colourHelp}>
            <ul className="flex flex-wrap gap-3">
              {colours.map((colour) => {
                const swatch = swatchFor(colour)
                return (
                  <li key={colour}>
                    {swatch ? (
                      <span
                        title={colour}
                        style={{ backgroundColor: swatch }}
                        className="block size-12 rounded-lg shadow-card"
                      >
                        <span className="sr-only">{colour}</span>
                      </span>
                    ) : (
                      <span className="flex h-12 items-center rounded-lg border border-secondary px-3 text-kit-body text-muted-foreground">
                        {colour}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </KitField>
        ) : null}
      </CardContent>
    </Card>
  )
}
