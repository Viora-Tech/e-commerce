'use client'

import { Search, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import type { DraftLine } from '@/components/drafts/draft-form-state'
import { draftEditorContent as copy } from '@/data/drafts'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

type DraftProductsCardProps = {
  lines: DraftLine[]
  onChange: (lines: DraftLine[]) => void
}

type Result = Awaited<ReturnType<typeof api.products.searchVariants>>[number]

const SEARCH_DEBOUNCE_MS = 250

const lineTitle = (l: { title: string; variantTitle: string }) =>
  l.variantTitle && l.variantTitle !== 'Default' ? `${l.title} / ${l.variantTitle}` : l.title

export default function DraftProductsCard({ lines, onChange }: DraftProductsCardProps) {
  // Hooks
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const term = search.trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(() => {
      api.products
        .searchVariants({ search: term, limit: 8 })
        .then((r) => !cancelled && setResults(r))
        .finally(() => !cancelled && setSearching(false))
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [search])

  // Event handlers
  const handleAdd = (r: Result) => {
    const existing = lines.find((l) => l.variantId === r.variantId)
    onChange(
      existing
        ? lines.map((l) => (l.variantId === r.variantId ? { ...l, quantity: l.quantity + 1 } : l))
        : [
            ...lines,
            {
              variantId: r.variantId,
              title: r.title,
              variantTitle: r.variantTitle,
              sku: r.sku,
              quantity: 1,
              unitPricePaise: r.pricePaise,
              imageUrl: r.imageUrl,
            },
          ],
    )
    setSearch('')
    setResults([])
  }

  const handleQuantity = (variantId: string, value: string) => {
    const quantity = Math.max(1, Number.parseInt(value, 10) || 1)
    onChange(lines.map((l) => (l.variantId === variantId ? { ...l, quantity } : l)))
  }

  const handlePrice = (variantId: string, value: string) => {
    const rupees = Math.max(0, Number.parseFloat(value) || 0)
    onChange(
      lines.map((l) =>
        l.variantId === variantId ? { ...l, unitPricePaise: Math.round(rupees * 100) } : l,
      ),
    )
  }

  const handleRemove = (variantId: string) => {
    onChange(lines.filter((l) => l.variantId !== variantId))
  }

  // Render logic
  return (
    <Card className="gap-4 p-5">
      <p className="text-kit-card-title text-foreground">{copy.products.heading}</p>
      <div className="relative">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={copy.products.search}
          className="pl-9"
        />
        {results.length > 0 ? (
          <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-card p-1 shadow-popover">
            {results.map((r) => (
              <li key={r.variantId}>
                <button
                  type="button"
                  onClick={() => handleAdd(r)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted"
                >
                  <span className="min-w-0 flex-1 truncate text-body">{lineTitle(r)}</span>
                  <span className="shrink-0 text-body text-muted-foreground tabular-nums">
                    {formatPaise(r.pricePaise)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {lines.length === 0 ? (
        <p className="text-body text-muted-foreground">
          {searching ? copy.products.searching : copy.products.empty}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {lines.map((l) => (
            <li key={l.variantId} className="flex items-center gap-3 py-3 first:pt-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-strong text-foreground">
                  {lineTitle(l)}
                </span>
                {l.sku ? (
                  <span className="block text-caption text-muted-foreground">{l.sku}</span>
                ) : null}
              </span>
              <Input
                aria-label={copy.products.quantity}
                type="number"
                min={1}
                value={l.quantity}
                onChange={(e) => handleQuantity(l.variantId, e.target.value)}
                className="w-20 text-right tabular-nums"
              />
              <Input
                aria-label={copy.products.price}
                type="number"
                min={0}
                step="0.01"
                value={(l.unitPricePaise / 100).toFixed(2)}
                onChange={(e) => handlePrice(l.variantId, e.target.value)}
                className="w-28 text-right tabular-nums"
              />
              <span className="w-24 shrink-0 text-right text-body tabular-nums">
                {formatPaise(l.quantity * l.unitPricePaise)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={copy.products.remove}
                onClick={() => handleRemove(l.variantId)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
