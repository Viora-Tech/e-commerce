'use client'

import { Plus, Search } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useEffect, useId, useState } from 'react'
import InlineState from '@/components/states/inline-state'
import { selectProductsContent } from '@/data/select-products'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import SelectProductsFilter from './select-products-filter'
import SelectProductsRow, { type PickRow } from './select-products-row'

/** What the dialog hands back: each product with the variants the merchant ticked. */
export type PickedProducts = { product: PickRow; variantIds: string[] }[]

type SelectProductsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Products already in the destination: ticked, locked and not counted. */
  addedProductIds?: string[]
  /** Pins the list to one collection and hides that filter. */
  collectionId?: string
  onConfirm: (picked: PickedProducts) => void
}

const ANY = '__any'
const INITIAL = { search: '', collection: ANY, productType: ANY, status: ANY, attempt: 0 }

type Request = typeof INITIAL
const SEARCH_DELAY_MS = 250

/**
 * The one product picker (Figma "Dialog · Select products"): search, collection, type and
 * status filters, variant expansion with a partial tick, "Show selected only", and a footer
 * that counts the picks. Used wherever a screen adds products to something.
 */
export default function SelectProductsDialog({
  open,
  onOpenChange,
  addedProductIds = [],
  collectionId,
  onConfirm,
}: SelectProductsDialogProps) {
  // Hooks
  const copy = useCopy(selectProductsContent)
  const switchId = useId()
  const [request, setRequest] = useState<Request>(INITIAL)
  const [selectedOnly, setSelectedOnly] = useState(false)
  const [rows, setRows] = useState<PickRow[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<Map<string, { row: PickRow; ids: Set<string> }>>(new Map())
  const [collections, setCollections] = useState<{ id: string; title: string }[]>([])
  const [types, setTypes] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setPicked(new Map())
    setRequest(INITIAL)
    setSelectedOnly(false)
    void api.collections.list().then(setCollections)
    void api.products.facets().then((f) => setTypes(f.productTypes))
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setFailed(false)
    const timer = setTimeout(() => {
      api.products
        .pick({
          search: request.search || undefined,
          collectionId:
            collectionId ?? (request.collection === ANY ? undefined : request.collection),
          productType: request.productType === ANY ? undefined : request.productType,
          status: request.status === ANY ? undefined : (request.status as 'active' | 'draft'),
        })
        .then((r) => !cancelled && setRows(r))
        .catch(() => !cancelled && setFailed(true))
        .finally(() => !cancelled && setLoading(false))
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, request, collectionId])

  // Helpers
  const patch = (next: Partial<Request>) => setRequest((r) => ({ ...r, ...next }))

  const setVariants = (row: PickRow, ids: Set<string>) =>
    setPicked((prev) => {
      const next = new Map(prev)
      if (ids.size === 0) next.delete(row.id)
      else next.set(row.id, { row, ids })
      return next
    })

  // Event handlers
  const handleToggleProduct = (row: PickRow, on: boolean) =>
    setVariants(row, on ? new Set(row.variants.map((v) => v.id)) : new Set())

  const handleToggleVariant = (row: PickRow, variantId: string, on: boolean) => {
    const ids = new Set(picked.get(row.id)?.ids)
    if (on) ids.add(variantId)
    else ids.delete(variantId)
    setVariants(row, ids)
  }

  const handleConfirm = () => {
    onConfirm([...picked.values()].map((p) => ({ product: p.row, variantIds: [...p.ids] })))
    onOpenChange(false)
  }

  // Render logic
  const added = new Set(addedProductIds)
  const visible = selectedOnly ? rows.filter((r) => picked.has(r.id)) : rows
  const variantTotal = [...picked.values()].reduce((n, p) => n + p.ids.size, 0)
  const anyVariants = [...picked.values()].some((p) => p.row.variants.length > 1)
  const empty = !loading && !failed && visible.length === 0
  const collectionItems = Object.fromEntries([
    [ANY, copy.anyCollection],
    ...collections.map((c) => [c.id, c.title]),
  ])
  const typeItems = Object.fromEntries([[ANY, copy.anyType], ...types.map((t) => [t, t])])
  const statusItems = {
    [ANY]: copy.anyStatus,
    active: copy.statuses.active,
    draft: copy.statuses.draft,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-[42rem]">
        <DialogHeader className="px-4 pt-4 pb-3">
          <DialogTitle className="text-base font-semibold">{copy.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-4 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-40 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                aria-label={copy.searchLabel}
                placeholder={copy.search}
                value={request.search}
                onChange={(e) => patch({ search: e.target.value })}
                className="pl-8"
              />
            </div>
            {collectionId ? null : (
              <SelectProductsFilter
                label={copy.collection}
                value={request.collection}
                items={collectionItems}
                onChange={(collection) => patch({ collection })}
              />
            )}
            <SelectProductsFilter
              label={copy.productType}
              value={request.productType}
              items={typeItems}
              onChange={(productType) => patch({ productType })}
            />
            <SelectProductsFilter
              label={copy.status}
              value={request.status}
              items={statusItems}
              onChange={(status) => patch({ status })}
            />
          </div>
          <div className="flex w-fit items-center gap-2 text-caption text-muted-foreground">
            <Switch id={switchId} checked={selectedOnly} onCheckedChange={setSelectedOnly} />
            <label htmlFor={switchId}>{copy.showSelectedOnly}</label>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto border-line border-t">
          {loading ? (
            <div className="flex flex-col gap-3 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : failed ? (
            <div className="p-4">
              <InlineState kind="error" onRetry={() => patch({ attempt: request.attempt + 1 })} />
            </div>
          ) : empty ? (
            <div className="p-4">
              <InlineState kind="empty" heading={selectedOnly ? copy.emptySelected : copy.empty} />
            </div>
          ) : (
            <ul>
              {visible.map((row) => (
                <SelectProductsRow
                  key={row.id}
                  row={row}
                  picked={picked.get(row.id)?.ids ?? new Set()}
                  added={added.has(row.id)}
                  onToggleProduct={handleToggleProduct}
                  onToggleVariant={handleToggleVariant}
                />
              ))}
            </ul>
          )}
        </div>
        <DialogFooter className="m-0 items-center justify-between rounded-b-xl border-line border-t bg-transparent px-4 py-3 sm:flex-row">
          <span className="text-caption text-muted-foreground">
            {anyVariants ? copy.summary(picked.size, variantTotal) : copy.productsOnly(picked.size)}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {copy.cancel}
            </Button>
            <Button disabled={picked.size === 0} onClick={handleConfirm}>
              <Plus aria-hidden="true" />
              {copy.add(picked.size)}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
