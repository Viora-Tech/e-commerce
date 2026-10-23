'use client'

import { Search, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { type ReactNode, useEffect, useState } from 'react'
import ResourcePickDialog, {
  type PickItem,
  type PickResult,
} from '@/components/pickers/resource-pick-dialog'
import ProductThumb from '@/components/products/product-thumb'
import { discountFormContent } from '@/data/discounts'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { type ItemKind, itemTabs, loadPicked } from './pick-sources'

type AppliesToPickerProps = {
  kind: ItemKind
  ids: string[]
  onChange: (next: { kind: ItemKind; ids: string[] }) => void
  /** Extra control on each picked row, before the remove button (e.g. an amount input). */
  rowExtra?: ((item: PickItem) => ReactNode) | undefined
}

/**
 * The products or collections a discount covers: a search field and Browse button that open
 * the Browse dialog, then the picks as removable rows with thumbnails.
 */
export default function AppliesToPicker({ kind, ids, onChange, rowExtra }: AppliesToPickerProps) {
  // Hooks
  const { value: copy } = useCopy(discountFormContent)
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [known, setKnown] = useState<PickItem[]>([])
  // biome-ignore lint/correctness/useExhaustiveDependencies: copy and locale only format the rows
  useEffect(() => {
    // Picks not seen in the dialog yet (an edited discount) are fetched by id so their titles
    // and per-product amount fields show however many products the store has.
    const missing = ids.filter((id) => !known.some((p) => p.id === id))
    if (missing.length === 0) return
    let cancelled = false
    loadPicked(kind, missing, copy, locale)
      .then((found) => {
        if (cancelled) return
        // Same array when nothing new came back (a deleted product): a new one would re-run
        // this effect and fetch again, forever.
        setKnown((prev) => {
          const fresh = found.filter((p) => !prev.some((x) => x.id === p.id))
          return fresh.length > 0 ? [...prev, ...fresh] : prev
        })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [kind, ids, known])

  // Event handlers
  const handleDone = (result: PickResult) => {
    setKnown((prev) => [...prev, ...result.items.filter((i) => !prev.some((p) => p.id === i.id))])
    onChange({ kind: result.tab as ItemKind, ids: result.ids })
    setOpen(false)
  }

  const handleRemove = (id: string) => onChange({ kind, ids: ids.filter((x) => x !== id) })

  // Render logic
  const chosen = ids
    .map((id) => known.find((p) => p.id === id))
    .filter((p): p is PickItem => Boolean(p))
  const search = kind === 'collections' ? copy.collectionSearch : copy.productSearch

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-body text-muted-foreground transition-[border-color] hover:border-ring/60"
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{search}</span>
        </button>
        <Button type="button" variant="outline" size="lg" onClick={() => setOpen(true)}>
          {copy.browse}
        </Button>
      </div>
      {chosen.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {chosen.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <ProductThumb url={p.imageUrl ?? null} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body-strong">{p.title}</span>
                {p.meta ? <span className="truncate text-caption">{p.meta}</span> : null}
              </span>
              {rowExtra ? <div className="w-32 shrink-0">{rowExtra(p)}</div> : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={copy.remove(p.title)}
                onClick={() => handleRemove(p.id)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : ids.length === 0 ? (
        <p className="text-caption">{copy.nothingPicked}</p>
      ) : null}
      <ResourcePickDialog
        open={open}
        title={copy.pickerTitle}
        tabs={itemTabs(copy, locale)}
        selected={{ tab: kind, ids }}
        onClose={() => setOpen(false)}
        onDone={handleDone}
      />
    </div>
  )
}
