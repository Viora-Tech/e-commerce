'use client'

import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import RecordCombobox from '@/components/pickers/record-combobox'
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
    <div className="flex gap-2">
      {/* The results float over the form below, like a menu, instead of pushing it down. */}
      <RecordCombobox
        list="popover"
        className="min-w-0 flex-1"
        placeholder={copy.search}
        disabled={disabled}
        query={search}
        onQueryChange={setSearch}
        items={results}
        itemKey={(r) => r.id}
        onPick={handlePick}
        renderItem={(r) => (
          <>
            <span className="min-w-0 flex-1 truncate text-body">{r.name}</span>
            <span className="text-caption text-muted-foreground">
              {r.country} · {r.currency}
            </span>
          </>
        )}
      />
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
