'use client'

import { X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { useEffect, useState } from 'react'
import RecordCombobox from '@/components/pickers/record-combobox'
import { customerPickerContent } from '@/data/customer-merge'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

export type PickedCustomer = Awaited<ReturnType<typeof api.customers.list>>['items'][number]

type CustomerPickerProps = {
  /**
   * `list` (default): a labelled field whose matches list under it, from 2 letters; the picked
   * one stays highlighted (merge customers, change an order's customer).
   * `dropdown`: focusing the empty field lists recent customers in a floating list; the pick
   * shows as a removable row (issue a gift card).
   */
  mode?: 'list' | 'dropdown'
  /** `list`: field id prefix, unique on the page. */
  id?: string
  /** `list`: left out of the results (the customer the dialog is about). */
  exceptId?: string | null | undefined
  /** The customer picked so far: highlighted (`list`) or shown as a row (`dropdown`). */
  value: PickedCustomer | null
  /** `list`: a row was picked. */
  onPick?: (customer: PickedCustomer) => void
  /** `dropdown`: a row was picked, or the picked one removed (null). */
  onChange?: (customer: PickedCustomer | null) => void
}

type Lookup = 'idle' | 'loading' | 'done' | 'failed'

const SEARCH_DEBOUNCE_MS = 250
const LIST_COUNT = 8
const DROPDOWN_COUNT = 6
const MIN_LETTERS = 2

/** Search the store's customers by name, email or mobile and pick one. */
export default function CustomerPicker({
  mode = 'list',
  id = 'customer-picker',
  exceptId,
  value,
  onPick,
  onChange,
}: CustomerPickerProps) {
  // Hooks
  const copy = useCopy(customerPickerContent)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<PickedCustomer[] | null>(null)
  const [lookup, setLookup] = useState<Lookup>('idle')

  useEffect(() => {
    const dropdown = mode === 'dropdown'
    const term = search.trim()
    // The list waits for 2 letters; the drop-down searches (or lists recent ones) while open.
    if (dropdown ? !open : term.length < MIN_LETTERS) {
      if (!dropdown) {
        setResults(null)
        setLookup('idle')
      }
      return
    }
    let cancelled = false
    setLookup('loading')
    const t = setTimeout(
      () => {
        api.customers
          .list({
            page: 1,
            perPage: dropdown ? DROPDOWN_COUNT : LIST_COUNT,
            search: term || undefined,
          })
          .then((r) => {
            if (cancelled) return
            setResults(dropdown ? r.items : r.items.filter((c) => c.id !== exceptId))
            setLookup('done')
          })
          .catch(() => {
            if (cancelled) return
            if (!dropdown) setResults([])
            setLookup('failed')
          })
      },
      term ? SEARCH_DEBOUNCE_MS : 0,
    )
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [search, open, mode, exceptId])

  // Event handlers
  const handlePick = (c: PickedCustomer) => {
    if (mode === 'dropdown') {
      onChange?.(c)
      setSearch('')
      return
    }
    onPick?.(c)
  }

  // Early returns
  if (mode === 'dropdown' && value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body-strong">{value.name || value.email}</span>
          {value.name && value.email ? (
            <span className="truncate text-caption text-muted-foreground">{value.email}</span>
          ) : null}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={copy.lookup.clear}
          onClick={() => onChange?.(null)}
        >
          <X />
        </Button>
      </div>
    )
  }

  if (mode === 'dropdown') {
    const found = results ?? []
    const status =
      lookup === 'loading' && found.length === 0
        ? copy.lookup.searching
        : lookup === 'failed'
          ? copy.lookup.failed
          : lookup === 'done' && found.length === 0
            ? copy.lookup.none
            : null
    return (
      <RecordCombobox
        list="popover"
        open={open}
        onOpenChange={setOpen}
        enterPicksFirst={lookup === 'done'}
        name="gift-card-customer-lookup"
        placeholder={copy.lookup.search}
        query={search}
        onQueryChange={setSearch}
        items={found}
        itemKey={(c) => c.id}
        status={status}
        onPick={handlePick}
        renderItem={(c) => (
          <span className="flex min-w-0 flex-col items-start">
            <span className="text-body text-foreground">{c.name ?? c.email}</span>
            {c.name && c.email ? (
              <span className="text-caption text-muted-foreground">{c.email}</span>
            ) : null}
          </span>
        )}
      />
    )
  }

  // Render logic
  const status = lookup === 'loading' ? copy.searching : results?.length === 0 ? copy.none : null

  return (
    <Field>
      <FieldLabel htmlFor={`${id}-search`}>{copy.label}</FieldLabel>
      <RecordCombobox
        id={`${id}-search`}
        placeholder={copy.placeholder}
        ariaLabel={copy.label}
        query={search}
        onQueryChange={setSearch}
        items={results ?? []}
        itemKey={(c) => c.id}
        isSelected={(c) => value?.id === c.id}
        onPick={handlePick}
        renderItem={(c) => (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
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
          </>
        )}
      />
      <FieldDescription>{status ?? copy.hint}</FieldDescription>
    </Field>
  )
}
