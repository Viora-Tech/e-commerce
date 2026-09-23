'use client'

import type { EmailBlock } from '@commerce/core/marketing'
import { Search, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import ProductThumb from '@/components/products/product-thumb'
import { campaignEditorContent } from '@/data/marketing-campaigns'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

type Items = Extract<EmailBlock, { type: 'products' }>['items']

type EmailProductsPickerProps = {
  items: Items
  onChange: (items: Items) => void
}

type Row = Awaited<ReturnType<typeof api.products.list>>['items'][number]

const MAX = 6
const copy = campaignEditorContent.fields

function toItem(p: Row): Items[number] {
  return {
    id: p.id,
    title: p.title,
    priceLabel: p.minPricePaise === null ? '' : formatPaise(p.minPricePaise),
    imageUrl: p.imageUrl,
    handle: p.handle,
  }
}

/** Search active products and add up to six to a products block; each keeps a snapshot for the email. */
export default function EmailProductsPicker({ items, onChange }: EmailProductsPickerProps) {
  // Hooks
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Row[]>([])

  useEffect(() => {
    let live = true
    const t = setTimeout(() => {
      api.products
        .list({ page: 1, perPage: 8, status: 'active', search: query.trim() || undefined })
        .then((r) => {
          if (live) setResults(r.items)
        })
    }, 200)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [query])

  // Event handlers
  const handleAdd = (p: Row) => {
    if (items.length >= MAX || items.some((i) => i.id === p.id)) return
    onChange([...items, toItem(p)])
  }

  const handleRemove = (id: string) => onChange(items.filter((i) => i.id !== id))

  // Render logic
  const picked = new Set(items.map((i) => i.id))

  return (
    <div className="flex flex-col gap-3">
      {items.length ? (
        <ul className="flex flex-col gap-2">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 rounded-md border border-border p-2">
              <ProductThumb url={i.imageUrl ?? null} alt={i.title} />
              <span className="min-w-0 flex-1 truncate text-body">{i.title}</span>
              <span className="text-caption text-muted-foreground tabular-nums">
                {i.priceLabel}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(i.id)}
                aria-label={i.title}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {items.length < MAX ? (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={copy.pickProducts}
              className="pl-9"
            />
          </div>
          <ul className="flex max-h-60 flex-col overflow-y-auto">
            {results
              .filter((p) => !picked.has(p.id))
              .map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => handleAdd(p)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                  >
                    <ProductThumb url={p.imageUrl} alt={p.title} />
                    <span className="min-w-0 flex-1 truncate text-body">{p.title}</span>
                  </button>
                </li>
              ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}
