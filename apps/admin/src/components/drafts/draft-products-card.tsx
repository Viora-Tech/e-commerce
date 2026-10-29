'use client'

import { Search, X } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import type { DraftLine } from '@/components/drafts/draft-form-state'
import DraftMoneyInput from '@/components/drafts/draft-money-input'
import DataCard from '@/components/layout/data-card'
import LineItemRow from '@/components/layout/line-item-row'
import { draftEditorContent } from '@/data/drafts'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

type DraftProductsCardProps = {
  lines: DraftLine[]
  onChange: (lines: DraftLine[]) => void
}

type Result = Awaited<ReturnType<typeof api.products.searchVariants>>[number]

const SEARCH_DEBOUNCE_MS = 250

const isDefault = (variantTitle: string) => !variantTitle || variantTitle === 'Default'

const lineTitle = (l: { title: string; variantTitle: string }) =>
  isDefault(l.variantTitle) ? l.title : `${l.title} / ${l.variantTitle}`

/** Search rows arrive ordered by product; fold them into one group per product. */
const groupByProduct = (rows: Result[]) =>
  rows.reduce<{ productId: string; title: string; variants: Result[] }[]>((groups, r) => {
    const last = groups.at(-1)
    if (last?.productId === r.productId) last.variants.push(r)
    else groups.push({ productId: r.productId, title: r.title, variants: [r] })
    return groups
  }, [])

export default function DraftProductsCard({ lines, onChange }: DraftProductsCardProps) {
  // Hooks
  const copy = useCopy(draftEditorContent)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState('')

  useEffect(() => {
    const term = search.trim()
    if (term.length < 2) {
      setResults([])
      setSearched('')
      return
    }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(() => {
      api.products
        .searchVariants({ search: term, limit: 10 })
        .then((r) => {
          if (cancelled) return
          setResults(r)
          setSearched(term)
        })
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
              unitPricePaise: r.pricePaise ?? 0,
              imageUrl: r.imageUrl,
              giftCard: r.giftCard,
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
  const groups = groupByProduct(results)
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
        </div>
        {groups.length > 0 ? (
          // In the page flow, not a floating dropdown: the card clips anything that overflows
          // it, which hid most of a product's variants.
          <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-1">
            {groups.map((g) =>
              g.variants.length === 1 && isDefault(g.variants[0]?.variantTitle ?? '') ? (
                <li key={g.productId}>
                  <ResultButton
                    label={g.title}
                    result={g.variants[0] as Result}
                    noPrice={copy.noPrice}
                    onAdd={handleAdd}
                  />
                </li>
              ) : (
                <li key={g.productId} className="flex flex-col">
                  <p className="px-2 pt-2 pb-1 font-medium text-body text-ink-strong">{g.title}</p>
                  <ul className="flex flex-col">
                    {g.variants.map((r) => (
                      <li key={r.variantId}>
                        <ResultButton
                          label={isDefault(r.variantTitle) ? r.title : r.variantTitle}
                          result={r}
                          noPrice={copy.noPrice}
                          onAdd={handleAdd}
                          inset
                        />
                      </li>
                    ))}
                  </ul>
                </li>
              ),
            )}
          </ul>
        ) : searched && !searching ? (
          <p className="text-body text-muted-foreground">{copy.products.noResults}</p>
        ) : null}
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

function ResultButton({
  label,
  result,
  noPrice,
  onAdd,
  inset = false,
}: {
  label: string
  result: Result
  noPrice: string
  onAdd: (r: Result) => void
  inset?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onAdd(result)}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted',
        inset && 'pl-5',
      )}
    >
      <span className="min-w-0 flex-1 truncate text-body">{label}</span>
      {result.sku ? (
        <span className="hidden shrink-0 text-caption text-muted-foreground sm:inline">
          {result.sku}
        </span>
      ) : null}
      <span className="shrink-0 text-body text-muted-foreground tabular-nums">
        {result.pricePaise == null ? noPrice : formatPaise(result.pricePaise)}
      </span>
    </button>
  )
}
