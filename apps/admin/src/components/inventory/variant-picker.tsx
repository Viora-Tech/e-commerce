'use client'

import { Plus } from '@commerce/ui/icons'
import { useEffect, useState } from 'react'
import KitSearch from '@/components/kit/kit-search'
import KitThumb from '@/components/kit/kit-thumb'
import { api } from '@/lib/api-client'

export type VariantHit = Awaited<ReturnType<typeof api.inventory.searchVariants>>[number]

type VariantPickerProps = {
  placeholder: string
  /** Stock figures in the results are read at this location. */
  locationId?: string | undefined
  /** Variants already on the document; hidden from the results. */
  pickedIds: string[]
  onPick: (hit: VariantHit) => void
  disabled?: boolean
}

export function variantLabel(hit: { productTitle: string; variantTitle: string }): string {
  return hit.variantTitle && hit.variantTitle !== 'Default'
    ? `${hit.productTitle} / ${hit.variantTitle}`
    : hit.productTitle
}

/**
 * Search box for purchase order and transfer lines. Matches list inline under
 * the field because form cards clip overflow.
 */
export default function VariantPicker({
  placeholder,
  locationId,
  pickedIds,
  onPick,
  disabled,
}: VariantPickerProps) {
  // Hooks
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<VariantHit[]>([])

  useEffect(() => {
    if (search.trim() === '') {
      setResults([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      api.inventory
        .searchVariants({ search, locationId, limit: 8 })
        .then((rows) => !cancelled && setResults(rows))
        .catch(() => !cancelled && setResults([]))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search, locationId])

  // Event handlers
  const handlePick = (hit: VariantHit) => {
    onPick(hit)
    setSearch('')
    setResults([])
  }

  // Render logic
  const unpicked = results.filter((r) => !pickedIds.includes(r.variantId))

  return (
    <div>
      <KitSearch
        size="toolbar"
        className="w-full"
        placeholder={placeholder}
        aria-label={placeholder}
        value={search}
        disabled={disabled}
        onChange={(e) => setSearch(e.target.value)}
      />
      {unpicked.length > 0 ? (
        <ul className="mt-1 w-full overflow-hidden rounded-lg border border-line bg-card">
          {unpicked.map((r) => (
            <li key={r.variantId}>
              <button
                type="button"
                onClick={() => handlePick(r)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-background"
              >
                <KitThumb src={r.imageUrl} alt="" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body">{variantLabel(r)}</span>
                  {r.sku ? (
                    <span className="truncate text-caption text-muted-foreground">{r.sku}</span>
                  ) : null}
                </span>
                <span className="text-caption text-muted-foreground tabular-nums">
                  {r.available}
                </span>
                <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
