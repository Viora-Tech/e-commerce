'use client'

import { Search, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import type { DraftLine } from '@/components/drafts/draft-form-state'
import DraftMoneyInput from '@/components/drafts/draft-money-input'
import DataCard from '@/components/layout/data-card'
import LineItemRow from '@/components/layout/line-item-row'
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

  const handlePrice = (variantId: string, unitPricePaise: number) => {
    onChange(lines.map((l) => (l.variantId === variantId ? { ...l, unitPricePaise } : l)))
  }

  const handleRemove = (variantId: string) => {
    onChange(lines.filter((l) => l.variantId !== variantId))
  }

  // Render logic
  return (
    <DataCard title={copy.products.heading}>
      <div className="flex flex-col gap-4">
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
          <ul className="flex flex-col divide-y divide-line">
            {lines.map((l) => (
              <LineItemRow
                key={l.variantId}
                imageUrl={l.imageUrl ?? null}
                title={lineTitle(l)}
                subtitle={l.sku}
                controls={
                  <>
                    <Input
                      aria-label={copy.products.quantity}
                      type="number"
                      min={1}
                      value={l.quantity}
                      onChange={(e) => handleQuantity(l.variantId, e.target.value)}
                      className="w-20 text-right tabular-nums"
                    />
                    <DraftMoneyInput
                      aria-label={copy.products.price}
                      valuePaise={l.unitPricePaise}
                      onChangePaise={(paise) => handlePrice(l.variantId, paise)}
                      className="w-28 text-right tabular-nums"
                    />
                  </>
                }
                amount={formatPaise(l.quantity * l.unitPricePaise)}
                aside={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={copy.products.remove}
                    onClick={() => handleRemove(l.variantId)}
                  >
                    <X />
                  </Button>
                }
              />
            ))}
          </ul>
        )}
      </div>
    </DataCard>
  )
}
