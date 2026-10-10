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
  }

  // Render logic
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <KitSearch
          size="toolbar"
          className="w-full"
          placeholder={copy.search}
          aria-label={copy.search}
          value={search}
          disabled={disabled}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="outline" onClick={() => setCreating(true)} disabled={disabled}>
          <Plus aria-hidden="true" />
          {copy.new}
        </Button>
      </div>
      {results.length > 0 ? (
        <ul className="w-full overflow-hidden rounded-lg border border-line bg-card">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => handlePick(r)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-background"
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
