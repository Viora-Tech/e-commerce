'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { type UIEvent, useEffect, useState } from 'react'
import type { PickRow } from '@/components/products/select-products-row'
import { ordersContent } from '@/data/orders'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import {
  type ProductPick,
  productState,
  toggleProduct,
  toggleVariant,
  variantPicked,
} from '@/lib/product-filter-selection'
import ProductFilterRow from './product-filter-row'
import ProductFilterVariants from './product-filter-variants'

/** The picks and the Is / Is not switch, as the Orders URL keeps them. */
export type ProductFilterValue = ProductPick & { productNot: boolean }

type ProductFilterPickerProps = {
  value: ProductFilterValue
  /** A change, with the row it came from so the chip can name it straight away. */
  onChange: (next: ProductFilterValue, row?: PickRow) => void
}

/** One page of the list; the next loads as the merchant scrolls near the end. */
const PAGE = 30
const SEARCH_DELAY_MS = 250
/** How close to the bottom (in pixels of scroll) the next page starts loading. */
const LOAD_AHEAD = 64

const asPickProduct = (row: PickRow) => ({ id: row.id, variantIds: row.variants.map((v) => v.id) })

/**
 * The Orders Product filter (Shopify's "Product is …"): the store's products with tick boxes,
 * found by title or SKU; › opens a product's variants to tick single sizes; Is / Is not turns
 * the filter around. Every tick applies at once, like the other filters.
 */
export default function ProductFilterPicker({ value, onChange }: ProductFilterPickerProps) {
  // Hooks
  const orders = useCopy(ordersContent)
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<PickRow[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [more, setMore] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the Try again button's re-run.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    const timer = setTimeout(() => {
      api.products
        .pick({ search: query.trim() || undefined, limit: PAGE })
        .then((r) => {
          if (cancelled) return
          setRows(r)
          setMore(r.length === PAGE)
        })
        .catch(() => !cancelled && setFailed(true))
        .finally(() => !cancelled && setLoading(false))
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, attempt])

  // Helpers
  const loadMore = () => {
    if (loading || !more) return
    setLoading(true)
    api.products
      .pick({ search: query.trim() || undefined, limit: PAGE, offset: rows.length })
      .then((r) => {
        setRows((prev) => [...prev, ...r.filter((x) => !prev.some((p) => p.id === x.id))])
        setMore(r.length === PAGE)
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }

  // Event handlers
  const handleToggleProduct = (row: PickRow, on: boolean) =>
    onChange({ ...value, ...toggleProduct(value, asPickProduct(row), on) }, row)
  const handleToggleVariant = (row: PickRow, variantId: string, on: boolean) =>
    onChange({ ...value, ...toggleVariant(value, asPickProduct(row), variantId, on) }, row)
  const handleMatch = (next: string[]) => {
    const picked = next[0]
    if (picked === 'is' || picked === 'is_not')
      onChange({ ...value, productNot: picked === 'is_not' })
  }
  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < LOAD_AHEAD) loadMore()
  }
  const handleSearch = (next: string) => {
    setQuery(next)
    setOpenId(null)
  }

  // Render logic
  const copy = orders.filters.picker
  const open = openId ? rows.find((r) => r.id === openId) : undefined
  const empty = !loading && !failed && rows.length === 0

  return (
    <div className="-mx-3.5 -my-3 flex flex-col">
      <div className="flex flex-col gap-2 border-border border-b px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{copy.matchLabel}</span>
          <ToggleGroup
            aria-label={copy.matchLabel}
            value={[value.productNot ? 'is_not' : 'is']}
            onValueChange={handleMatch}
            variant="outline"
            size="sm"
            spacing={0}
          >
            <ToggleGroupItem value="is" className="px-2.5">
              {copy.is}
            </ToggleGroupItem>
            <ToggleGroupItem value="is_not" className="px-2.5">
              {copy.isNot}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <Input
          type="search"
          aria-label={copy.search}
          placeholder={copy.search}
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>
      <div className="max-h-72 overflow-y-auto overscroll-contain" onScroll={handleScroll}>
        {open ? (
          <ProductFilterVariants
            row={open}
            state={productState(value, asPickProduct(open))}
            isPicked={(id) => variantPicked(value, asPickProduct(open), id)}
            onToggleProduct={handleToggleProduct}
            onToggleVariant={handleToggleVariant}
            onBack={() => setOpenId(null)}
          />
        ) : (
          <ul className="flex flex-col">
            {rows.map((row) => (
              <ProductFilterRow
                key={row.id}
                row={row}
                state={productState(value, asPickProduct(row))}
                query={query}
                onToggle={handleToggleProduct}
                onOpen={(r) => setOpenId(r.id)}
              />
            ))}
          </ul>
        )}
        {empty ? <p className="px-3.5 py-3 text-body text-muted-foreground">{copy.empty}</p> : null}
        {failed ? (
          <div className="flex items-center justify-between gap-2 px-3.5 py-3">
            <p className="text-body text-danger">{copy.failed}</p>
            <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
              {copy.retry}
            </Button>
          </div>
        ) : null}
        {loading ? (
          <div className="flex justify-center py-3 text-muted-foreground">
            <Spinner />
          </div>
        ) : null}
        {!open && more && !loading && !failed ? (
          <div className="flex justify-center py-2">
            <Button variant="ghost" size="sm" onClick={loadMore}>
              {copy.loadMore}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
