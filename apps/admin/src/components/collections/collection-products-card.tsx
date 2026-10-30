'use client'

import { siteConfig } from '@commerce/config/site'
import {
  COLLECTION_SORTS,
  type CollectionKind,
  type CollectionSort,
} from '@commerce/core/collections'
import { Plus, Search } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'

import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { SortableList } from '@commerce/ui/sortable'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import FormDialog from '@/components/layout/form-dialog'
import SelectProductsDialog, {
  type PickedProducts,
} from '@/components/products/select-products-dialog'
import ResourceTablePagination from '@/components/table/resource-table/pagination'
import { collectionDetailContent, SORT_LABELS } from '@/data/collections'
import { useCopy } from '@/hooks/use-copy'
import CollectionProductRow, { COLLECTION_PRODUCT_GRID } from './collection-product-row'
import { moveToPosition, type PickedProduct } from './form-state'

type CollectionProductsCardProps = {
  kind: CollectionKind
  products: PickedProduct[]
  sortOrder: CollectionSort
  onSortChange: (sort: CollectionSort) => void
  /** Manual collections only: add, remove and reorder. */
  onProducts: (products: PickedProduct[]) => void
}

function displayOrder(products: PickedProduct[], sort: CollectionSort): PickedProduct[] {
  const price = (p: PickedProduct) => p.pricePaiseMin ?? 0
  if (sort === 'title_asc') return [...products].sort((a, b) => a.title.localeCompare(b.title))
  if (sort === 'title_desc') return [...products].sort((a, b) => b.title.localeCompare(a.title))
  if (sort === 'price_asc') return [...products].sort((a, b) => price(a) - price(b))
  if (sort === 'price_desc') return [...products].sort((a, b) => price(b) - price(a))
  return products
}

function fromPick(picked: PickedProducts): PickedProduct[] {
  return picked.map(({ product: p }) => ({
    id: p.id,
    title: p.title,
    imageUrl: p.imageUrl,
    status: p.status,
    available: p.available,
    pricePaiseMin: p.pricePaiseMin,
    pricePaiseMax: p.pricePaiseMax,
  }))
}

/**
 * "Products in this collection": only this collection's products. Manual collections add through
 * the Select products dialog and remove or drag to reorder; automatic ones list what the
 * conditions matched, read only.
 */
export default function CollectionProductsCard({
  kind,
  products,
  sortOrder,
  onSortChange,
  onProducts,
}: CollectionProductsCardProps) {
  // Hooks
  const { products: copy } = useCopy(collectionDetailContent)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)
  const [adding, setAdding] = useState(false)
  const [moving, setMoving] = useState<PickedProduct | null>(null)
  const [moveTo, setMoveTo] = useState('')
  const [moveTried, setMoveTried] = useState(false)

  // Event handlers
  const handleAdd = (picked: PickedProducts) => {
    const have = new Set(products.map((p) => p.id))
    onProducts([...products, ...fromPick(picked).filter((p) => !have.has(p.id))])
  }

  const handleRemove = (id: string) => onProducts(products.filter((p) => p.id !== id))

  const handleMoveOpen = (p: PickedProduct) => {
    setMoving(p)
    setMoveTo(String(products.findIndex((x) => x.id === p.id) + 1))
    setMoveTried(false)
  }

  const handleMove = () => {
    setMoveTried(true)
    const position = Number(moveTo)
    if (!moving || !Number.isInteger(position) || position < 1 || position > products.length) {
      return
    }
    onProducts(moveToPosition(products, moving.id, position))
    setMoving(null)
  }

  // Render logic
  const manual = kind === 'manual'
  const needle = query.trim().toLowerCase()
  const shown = displayOrder(products, sortOrder).filter(
    (p) => needle === '' || p.title.toLowerCase().includes(needle),
  )
  const start = (page - 1) * perPage
  const rows = shown.slice(start, start + perPage)
  const draggable = manual && sortOrder === 'manual' && needle === ''
  const moveValue = Number(moveTo)
  const moveInvalid =
    moveTried && (!Number.isInteger(moveValue) || moveValue < 1 || moveValue > products.length)
  const sortItems = Object.fromEntries(COLLECTION_SORTS.map((s) => [s, SORT_LABELS[s]]))
  const emptyHeading =
    needle !== '' ? copy.emptySearch : manual ? copy.emptyManual : copy.emptyAutomatic
  const emptyBody = needle !== '' ? null : manual ? copy.emptyManualBody : copy.emptyAutomaticBody

  return (
    <DataCard
      title={copy.heading}
      count={products.length}
      flush
      action={
        manual ? (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            {copy.add}
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-3 px-5 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-40 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              aria-label={copy.search}
              placeholder={copy.search}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
              className="pl-8"
            />
          </div>
          <div className="flex items-center">
            <Select
              items={sortItems}
              value={sortOrder}
              onValueChange={(next) => onSortChange(String(next) as CollectionSort)}
            >
              <SelectTrigger aria-label={copy.sort} className="w-52">
                <span className="text-muted-foreground">{copy.sort}:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLLECTION_SORTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SORT_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div
        className={`${COLLECTION_PRODUCT_GRID} h-10 border-line border-y px-4 text-caption text-muted-foreground`}
      >
        <span />
        <span>{copy.columns.product}</span>
        <span className="text-center">{copy.columns.status}</span>
        <span>{copy.columns.stock}</span>
        <span className="text-right">{copy.columns.price}</span>
        <span />
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
          <p className="text-body font-medium text-foreground">{emptyHeading}</p>
          {emptyBody ? <p className="text-body text-muted-foreground">{emptyBody}</p> : null}
        </div>
      ) : draggable ? (
        <SortableList
          items={rows}
          onReorder={(next) =>
            onProducts([
              ...products.slice(0, start),
              ...next,
              ...products.slice(start + rows.length),
            ])
          }
          getTitle={(p) => p.title}
          labels={copy.sortLabels}
          className="divide-y divide-line"
          renderItem={(p, { handle }) => (
            <CollectionProductRow
              product={p}
              handle={handle}
              position={start + rows.indexOf(p) + 1}
              onMove={() => handleMoveOpen(p)}
              onRemove={() => handleRemove(p.id)}
            />
          )}
        />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((p) => (
            <li key={p.id}>
              <CollectionProductRow
                product={p}
                onRemove={manual ? () => handleRemove(p.id) : undefined}
              />
            </li>
          ))}
        </ul>
      )}
      <ResourceTablePagination
        page={page}
        perPage={perPage}
        total={shown.length}
        onPageChange={setPage}
        onPerPageChange={(n) => {
          setPerPage(n)
          setPage(1)
        }}
      />
      {moving ? (
        <FormDialog
          open
          onOpenChange={(open) => {
            if (!open) setMoving(null)
          }}
          title={copy.move.title(moving.title)}
          submitLabel={copy.move.submit}
          onSubmit={handleMove}
        >
          <Field data-invalid={moveInvalid ? true : undefined}>
            <FieldLabel htmlFor="collection-move-to">{copy.move.label}</FieldLabel>
            <Input
              id="collection-move-to"
              type="number"
              inputMode="numeric"
              min={1}
              max={products.length}
              value={moveTo}
              aria-invalid={moveInvalid ? true : undefined}
              onChange={(e) => setMoveTo(e.target.value)}
              className="w-28"
            />
            {moveInvalid ? (
              <FieldError>{copy.move.invalid(products.length)}</FieldError>
            ) : (
              <FieldDescription>{copy.move.help(products.length)}</FieldDescription>
            )}
          </Field>
        </FormDialog>
      ) : null}
      {manual ? (
        <SelectProductsDialog
          open={adding}
          onOpenChange={setAdding}
          addedProductIds={products.map((p) => p.id)}
          onConfirm={handleAdd}
        />
      ) : null}
    </DataCard>
  )
}
