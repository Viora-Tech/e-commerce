'use client'

import { Search, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import { type ReactNode, useEffect, useState } from 'react'
import ProductThumb from '@/components/products/product-thumb'
import { discountFormContent } from '@/data/discounts'
import { api } from '@/lib/api-client'

type ProductRow = Awaited<ReturnType<typeof api.products.list>>['items'][number]

type ProductPickerProps = {
  selected: string[]
  onChange: (ids: string[]) => void
  /** Extra control on each picked row, before the remove button (e.g. an amount input). */
  rowExtra?: ((product: ProductRow) => ReactNode) | undefined
}

const copy = discountFormContent.value
const PAGE_SIZE = 8

/**
 * Search-and-tick picker for the products a discount covers. Picked products
 * stay listed above the results so the merchant can see and remove them.
 */
export default function ProductPicker({ selected, onChange, rowExtra }: ProductPickerProps) {
  // Hooks
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductRow[]>([])
  const [picked, setPicked] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.products
      .list({ page: 1, perPage: PAGE_SIZE, search: query || undefined })
      .then((r) => !cancelled && setResults(r.items))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [query])
  useEffect(() => {
    // Picked products the search has not surfaced yet are fetched once so their titles show.
    const missing = selected.filter((id) => !picked.some((p) => p.id === id))
    if (missing.length === 0) return
    let cancelled = false
    api.products
      .list({ page: 1, perPage: 100 })
      .then((r) => {
        if (cancelled) return
        setPicked((prev) => [...prev, ...r.items.filter((p) => missing.includes(p.id))])
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [selected, picked])

  // Event handlers
  const handleToggle = (p: ProductRow, on: boolean) => {
    if (on) {
      onChange([...selected, p.id])
      setPicked((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]))
    } else {
      onChange(selected.filter((id) => id !== p.id))
    }
  }

  // Render logic
  const chosen = selected
    .map((id) => picked.find((p) => p.id === id) ?? results.find((p) => p.id === id))
    .filter((p): p is ProductRow => Boolean(p))

  return (
    <div className="flex flex-col gap-3">
      {chosen.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {chosen.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <ProductThumb url={p.imageUrl} />
              <span className="min-w-0 flex-1 truncate text-body-strong">{p.title}</span>
              {rowExtra ? <div className="w-32 shrink-0">{rowExtra(p)}</div> : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${p.title}`}
                onClick={() => handleToggle(p, false)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          size="lg"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.productSearch}
          aria-label={copy.productSearch}
        />
      </div>
      <ul
        className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border"
        aria-busy={loading}
      >
        {results.length === 0 && !loading ? (
          <li className="px-3 py-3 text-caption">{copy.noProducts}</li>
        ) : null}
        {results.map((p) => {
          const on = selected.includes(p.id)
          return (
            <li key={p.id}>
              <label
                htmlFor={`pick-${p.id}`}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted"
              >
                <Checkbox
                  id={`pick-${p.id}`}
                  checked={on}
                  onCheckedChange={(v) => handleToggle(p, Boolean(v))}
                />
                <ProductThumb url={p.imageUrl} />
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
