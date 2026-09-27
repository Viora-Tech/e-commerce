'use client'

import { X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useRef, useState } from 'react'
import { productFormContent } from '@/data/products'
import {
  findCategory,
  loadTaxonomy,
  searchCategories,
  type TaxonomyCategory,
} from '@/lib/product-taxonomy'

type ProductCategoryPickerProps = {
  id?: string | undefined
  /** Shopify Standard Product Taxonomy category id, or null when unset. */
  value: string | null
  onChange: (categoryId: string | null) => void
}

const RESULT_LIMIT = 20

/**
 * Searchable picker over Shopify's open-source Standard Product Taxonomy
 * (vendored trimmed, lazy-loaded — see THIRD_PARTY_NOTICES.md). Stores just
 * the category id; `productType`/vendor/tags stay separate, free-text fields.
 */
export default function ProductCategoryPicker({ id, value, onChange }: ProductCategoryPickerProps) {
  // Hooks
  const [categories, setCategories] = useState<TaxonomyCategory[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Helpers
  const ensureLoaded = () => {
    if (categories || loading) return
    setLoading(true)
    loadTaxonomy()
      .then(setCategories)
      .finally(() => setLoading(false))
  }

  // Event handlers
  const handleFocus = () => {
    ensureLoaded()
    setOpen(true)
  }

  const handlePick = (category: TaxonomyCategory) => {
    onChange(category.id)
    setQuery('')
    setOpen(false)
  }

  const handleClear = () => {
    onChange(null)
    setQuery('')
  }

  // Render logic
  const selected = findCategory(categories ?? [], value)
  const results = categories ? searchCategories(categories, query, RESULT_LIMIT) : []

  return (
    <div ref={rootRef} className="relative flex flex-col gap-2">
      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
          <div className="flex flex-col">
            <span className="text-body font-medium text-ink-strong">{selected.name}</span>
            <span className="text-caption text-muted-foreground">{selected.path}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={productFormContent.categories.categoryClear}
            onClick={handleClear}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <Input
          size="kit"
          id={id}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          placeholder={
            value && !categories
              ? productFormContent.categories.categoryLoading
              : productFormContent.categories.categoryPlaceholder
          }
          autoComplete="off"
        />
      )}
      {open && !selected ? (
        <div className="absolute top-full z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
          {loading ? (
            <p className="px-2 py-1.5 text-caption text-muted-foreground">
              {productFormContent.categories.categoryLoading}
            </p>
          ) : query.trim() === '' ? (
            <p className="px-2 py-1.5 text-caption text-muted-foreground">
              {productFormContent.categories.categorySearchHint}
            </p>
          ) : results.length === 0 ? (
            <p className="px-2 py-1.5 text-caption text-muted-foreground">
              {productFormContent.categories.categoryNoResults}
            </p>
          ) : (
            <ul>
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(c)}
                    className="flex w-full flex-col rounded-sm px-2 py-1.5 text-left hover:bg-accent"
                  >
                    <span className="text-body">{c.name}</span>
                    <span className="text-caption text-muted-foreground">{c.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
