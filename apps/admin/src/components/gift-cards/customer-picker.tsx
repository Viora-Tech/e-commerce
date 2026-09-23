'use client'

import { Search, X } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import { giftCardIssueContent as copy } from '@/data/gift-cards'
import { api } from '@/lib/api-client'

export type PickedCustomer = { id: string; name: string | null; email: string | null }

type CustomerPickerProps = {
  value: PickedCustomer | null
  onChange: (customer: PickedCustomer | null) => void
}

const SEARCH_DEBOUNCE_MS = 250

/** Search-as-you-type customer lookup; shows the chosen customer as a removable row. */
export default function CustomerPicker({ value, onChange }: CustomerPickerProps) {
  // Hooks
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<PickedCustomer[]>([])

  useEffect(() => {
    const term = search.trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      api.customers
        .list({ page: 1, perPage: 6, search: term })
        .then((r) => !cancelled && setResults(r.items))
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [search])

  // Event handlers
  const handlePick = (c: PickedCustomer) => {
    onChange(c)
    setSearch('')
    setResults([])
  }

  // Early returns
  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body-strong">{value.name || value.email}</span>
          {value.name && value.email ? (
            <span className="truncate text-caption text-muted-foreground">{value.email}</span>
          ) : null}
        </span>
        <button
          type="button"
          aria-label={copy.clear}
          onClick={() => onChange(null)}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={copy.customerSearch}
        className="pl-9"
      />
      {results.length > 0 ? (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card p-1 shadow-popover">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => handlePick(c)}
                className="flex w-full flex-col items-start rounded-md px-2 py-2 text-left hover:bg-muted"
              >
                <span className="text-body text-foreground">{c.name ?? c.email}</span>
                <span className="text-caption text-muted-foreground">{c.email}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
