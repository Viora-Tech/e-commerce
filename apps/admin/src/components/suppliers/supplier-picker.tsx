'use client'

import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import KitSearch from '@/components/kit/kit-search'
import { supplierPickerContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import NewSupplierDialog, { type PickedSupplier } from './new-supplier-dialog'

type SupplierPickerProps = {
  disabled?: boolean
  onPick: (supplier: PickedSupplier) => void
}

type Hit = Awaited<ReturnType<typeof api.suppliers.list>>['rows'][number]

/** Search saved suppliers, or add a new one without leaving the purchase order. */
export default function SupplierPicker({ disabled, onPick }: SupplierPickerProps) {
  // Hooks
  const copy = useCopy(supplierPickerContent)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Hit[]>([])
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (search.trim() === '') {
      setResults([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      api.suppliers
        .list({ search, perPage: 8 })
        .then((r) => !cancelled && setResults(r.rows))
        .catch(() => !cancelled && setResults([]))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search])

  // Event handlers
  const handlePick = (supplier: PickedSupplier) => {
    onPick(supplier)
    setSearch('')
    setResults([])
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') setOpen(false)
  }

  // Render logic
  return (
    <div className="flex gap-2">
      {/* The results float over the form below, like a menu, instead of pushing it down. */}
      <div className="relative min-w-0 flex-1">
        <KitSearch
          size="toolbar"
          className="w-full"
          placeholder={copy.search}
          aria-label={copy.search}
          role="combobox"
          aria-expanded={open && results.length > 0}
          autoComplete="off"
          value={search}
          disabled={disabled}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
        />
        {open && results.length > 0 ? (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-popover">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  // Keeps focus in the field, so its blur does not close the list before the click.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePick(r)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted"
                >
                  <span className="min-w-0 flex-1 truncate text-body">{r.name}</span>
                  <span className="text-caption text-muted-foreground">
                    {r.country} · {r.currency}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Button variant="outline" onClick={() => setCreating(true)} disabled={disabled}>
        <Plus aria-hidden="true" />
        {copy.new}
      </Button>
      {creating ? (
        <NewSupplierDialog
          open={creating}
          initialName={search.trim()}
          onOpenChange={setCreating}
          onCreated={handlePick}
        />
      ) : null}
    </div>
  )
}
