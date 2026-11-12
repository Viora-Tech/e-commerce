'use client'

import { Search } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import { customerPickerContent } from '@/data/customer-merge'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

export type PickedCustomer = Awaited<ReturnType<typeof api.customers.list>>['items'][number]

type CustomerPickerProps = {
  /** Field id prefix, unique on the page. */
  id: string
  /** Left out of the results (the customer the dialog is about). */
  exceptId?: string | null | undefined
  /** The customer picked so far, highlighted in the list. */
  value: PickedCustomer | null
  onPick: (customer: PickedCustomer) => void
}

const SEARCH_DEBOUNCE_MS = 250

/** Search the store's customers by name, email or mobile and pick one. */
export default function CustomerPicker({ id, exceptId, value, onPick }: CustomerPickerProps) {
  // Hooks
  const copy = useCopy(customerPickerContent)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<PickedCustomer[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const term = search.trim()
    if (term.length < 2) {
      setResults(null)
      return
    }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(() => {
      api.customers
        .list({ page: 1, perPage: 8, search: term })
        .then((r) => {
          if (!cancelled) setResults(r.items.filter((c) => c.id !== exceptId))
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [search, exceptId])

  // Render logic
  const status = loading ? copy.searching : results?.length === 0 ? copy.none : null

  return (
    <Field>
      <FieldLabel htmlFor={`${id}-search`}>{copy.label}</FieldLabel>
      <div className="relative">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
        <Input
          id={`${id}-search`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={copy.placeholder}
          className="pl-9 [&::-webkit-search-cancel-button]:hidden"
          type="search"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
        />
      </div>
      {results && results.length > 0 ? (
        <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border p-1">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(c)}
                aria-pressed={value?.id === c.id}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-muted',
                  value?.id === c.id && 'bg-muted',
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-body text-foreground">
                    {c.name || c.email || copy.unnamed}
                  </span>
                  <span className="truncate text-caption text-muted-foreground">
                    {[c.email, c.phone].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-caption text-muted-foreground">
                  {copy.orders(c.orderCount)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <FieldDescription>{status ?? copy.hint}</FieldDescription>
    </Field>
  )
}
