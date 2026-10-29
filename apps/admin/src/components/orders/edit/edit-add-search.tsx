'use client'

import { Search } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import { orderEditContent } from '@/data/order-edit'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import { lineName, type VariantResult } from './edit-state'

type EditAddSearchProps = {
  onAdd: (variant: VariantResult) => void
}

const SEARCH_DEBOUNCE_MS = 250

/** Find a product to add to the order; gift cards are left out (they are issued on payment). */
export default function EditAddSearch({ onAdd }: EditAddSearchProps) {
  // Hooks
  const copy = useCopy(orderEditContent)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<VariantResult[]>([])
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
          setResults(r.filter((v) => !v.giftCard))
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
  const handlePick = (v: VariantResult) => {
    onAdd(v)
    setSearch('')
    setResults([])
  }

  // Render logic
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={copy.search}
          aria-label={copy.search}
          className="pl-9"
        />
      </div>
      {results.length > 0 ? (
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-1">
          {results.map((r) => (
            <li key={r.variantId}>
              <button
                type="button"
                onClick={() => handlePick(r)}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted"
              >
                <span className="min-w-0 flex-1 truncate text-body">
                  {lineName(r.title, r.variantTitle)}
                </span>
                {r.sku ? (
                  <span className="hidden shrink-0 text-caption text-muted-foreground sm:inline">
                    {r.sku}
                  </span>
                ) : null}
                <span className="shrink-0 text-body text-muted-foreground tabular-nums">
                  {r.pricePaise == null ? copy.noPrice : formatPaise(r.pricePaise)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : searching ? (
        <p className="text-body text-muted-foreground">{copy.searching}</p>
      ) : searched ? (
        <p className="text-body text-muted-foreground">{copy.noResults}</p>
      ) : null}
    </div>
  )
}
