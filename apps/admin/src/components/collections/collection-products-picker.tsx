'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from '@commerce/ui/icons'
import { useEffect, useState } from 'react'
import KitIconButton from '@/components/kit/kit-icon-button'
import KitSearch from '@/components/kit/kit-search'
import KitThumb from '@/components/kit/kit-thumb'
import { collectionFormContent as copy } from '@/data/collections'
import { api } from '@/lib/api-client'

export type PickedProduct = {
  id: string
  title: string
  imageUrl: string | null
}

type CollectionProductsPickerProps = {
  products: PickedProduct[]
  onChange: (products: PickedProduct[]) => void
}

/** Manual membership: search to add, arrows to order, which becomes `position`. */
export default function CollectionProductsPicker({
  products,
  onChange,
}: CollectionProductsPickerProps) {
  // Hooks
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<PickedProduct[]>([])

  useEffect(() => {
    if (search.trim() === '') {
      setResults([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      api.collections
        .searchProducts({ search, limit: 8 })
        .then((rows) => !cancelled && setResults(rows))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search])

  // Event handlers
  const handleAdd = (product: PickedProduct) => {
    if (products.some((p) => p.id === product.id)) return
    onChange([...products, product])
    setSearch('')
    setResults([])
  }

  const handleRemove = (id: string) => {
    onChange(products.filter((p) => p.id !== id))
  }

  const handleMove = (index: number, delta: number) => {
    const next = [...products]
    const target = index + delta
    const moved = next[index]
    const swapped = next[target]
    if (!moved || !swapped) return
    next[index] = swapped
    next[target] = moved
    onChange(next)
  }

  // Render logic
  const unpicked = results.filter((r) => !products.some((p) => p.id === r.id))

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <KitSearch
          size="toolbar"
          className="w-full"
          placeholder={copy.products.search}
          aria-label={copy.products.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {unpicked.length > 0 ? (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line bg-card shadow-popover">
            {unpicked.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => handleAdd(r)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-background"
                >
                  <KitThumb src={r.imageUrl} alt="" />
                  <span className="min-w-0 flex-1 truncate text-body">{r.title}</span>
                  <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {products.length === 0 ? (
        <p className="text-body text-muted-foreground">{copy.products.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {products.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-md border border-line bg-card p-2"
            >
              <KitThumb src={p.imageUrl} alt="" />
              <span className="min-w-0 flex-1 truncate text-body">{p.title}</span>
              <KitIconButton
                label={copy.products.moveUp}
                disabled={i === 0}
                onClick={() => handleMove(i, -1)}
                className="size-8 disabled:opacity-40"
              >
                <ArrowUp aria-hidden="true" />
              </KitIconButton>
              <KitIconButton
                label={copy.products.moveDown}
                disabled={i === products.length - 1}
                onClick={() => handleMove(i, 1)}
                className="size-8 disabled:opacity-40"
              >
                <ArrowDown aria-hidden="true" />
              </KitIconButton>
              <KitIconButton
                label={copy.products.remove}
                onClick={() => handleRemove(p.id)}
                className="size-8"
              >
                <Trash2 aria-hidden="true" />
              </KitIconButton>
            </li>
          ))}
        </ul>
      )}
      <p className="text-caption text-muted-foreground">{copy.products.count(products.length)}</p>
    </div>
  )
}
