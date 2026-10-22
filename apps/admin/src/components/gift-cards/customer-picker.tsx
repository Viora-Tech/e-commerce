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

type Lookup = 'idle' | 'loading' | 'done' | 'failed'

const SEARCH_DEBOUNCE_MS = 250
const RESULT_COUNT = 6

/**
 * Search-as-you-type customer lookup. Focusing the empty field lists recent customers; the list
 * says when it is searching, found nothing or failed. The chosen customer shows as a removable row.
 */
export default function CustomerPicker({ value, onChange }: CustomerPickerProps) {
  // Hooks
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<PickedCustomer[]>([])
  const [lookup, setLookup] = useState<Lookup>('idle')

  useEffect(() => {
    if (!open) return
    const term = search.trim()
    let cancelled = false
    setLookup('loading')
    const t = setTimeout(
      () => {
        api.customers
          .list({ page: 1, perPage: RESULT_COUNT, search: term || undefined })
          .then((r) => {
            if (cancelled) return
            setResults(r.items)
            setLookup('done')
          })
          .catch(() => !cancelled && setLookup('failed'))
      },
      term ? SEARCH_DEBOUNCE_MS : 0,
    )
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [search, open])

  // Event handlers
  const handlePick = (c: PickedCustomer) => {
    onChange(c)
    setSearch('')
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') setOpen(false)
    if (e.key === 'Enter' && results[0] && lookup === 'done') {
      e.preventDefault()
      handlePick(results[0])
    }
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

  // Render logic
  const status =
    lookup === 'loading' && results.length === 0
      ? copy.customerSearching
      : lookup === 'failed'
        ? copy.customerFailed
        : lookup === 'done' && results.length === 0
          ? copy.customerNone
          : null

  return (
    <div className="relative">
      <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        placeholder={copy.customerSearch}
        className="pl-9 [&::-webkit-search-cancel-button]:hidden"
        role="combobox"
        aria-expanded={open}
        type="search"
        name="gift-card-customer-lookup"
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
      />
      {open && (status || results.length > 0) ? (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card p-1 shadow-popover">
          {status ? (
            <li className="px-2 py-2 text-caption text-muted-foreground">{status}</li>
          ) : (
            results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePick(c)}
                  className="flex w-full flex-col items-start rounded-md px-2 py-2 text-left hover:bg-muted"
                >
                  <span className="text-body text-foreground">{c.name ?? c.email}</span>
                  {c.name && c.email ? (
                    <span className="text-caption text-muted-foreground">{c.email}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
