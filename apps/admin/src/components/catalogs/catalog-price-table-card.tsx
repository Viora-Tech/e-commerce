'use client'

import { Search } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import PillTabs from '@/components/layout/pill-tabs'
import ProductThumb from '@/components/products/product-thumb'
import { catalogsContent } from '@/data/catalogs'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { FixedPriceDraft } from './catalog-form-state'

type Page = Awaited<ReturnType<typeof api.catalogs.productPrices>>

type CatalogPriceTableCardProps = {
  catalogId: string
  /** The adjustment typed on the pricing card, in basis points (null while not a number). */
  adjustmentBp: number | null
  /** The market currency fixed prices are typed in; null when prices stay the store's own. */
  currency: string | null
  prices: FixedPriceDraft[]
  disabled: boolean
  onPrices: (prices: FixedPriceDraft[]) => void
}

const PER_PAGE = 20
const SEARCH_DELAY_MS = 250

type Tab = 'included' | 'excluded'

/** "Red / M" for a variant row, nothing for a product's only one. */
function variantName(title: string, count: number): string | null {
  return count > 1 && title && title !== 'Default' ? title : null
}

/**
 * Markets › Catalog: every product the catalog includes or leaves out, Shopify-style
 * (audit #161), with its store price and the catalog's price. In a market currency the price
 * is typed on the row (a fixed price); blank keeps the adjusted store price.
 */
export default function CatalogPriceTableCard({
  catalogId,
  adjustmentBp,
  currency,
  prices,
  disabled,
  onPrices,
}: CatalogPriceTableCardProps) {
  // Hooks
  const { priceTable: copy } = useCopy(catalogsContent)
  const fmt = useFormat()
  const [tab, setTab] = useState<Tab>('included')
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Page | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    api.catalogs
      .productPrices({
        id: catalogId,
        included: tab === 'included',
        search: search || undefined,
        page,
        perPage: PER_PAGE,
      })
      .then((next) => !cancelled && setData(next))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [catalogId, tab, search, page])

  // Helpers
  const adjusted = (paise: number) =>
    adjustmentBp === null ? paise : Math.round((paise * (10_000 + adjustmentBp)) / 10_000)

  // Event handlers
  const handleTab = (next: Tab) => {
    setTab(next)
    setPage(1)
  }

  const handleQuery = (next: string) => {
    setQuery(next)
    setPage(1)
  }

  const handleAmount = (variantId: string, label: string, amount: string) => {
    const rest = prices.filter((p) => p.variantId !== variantId)
    onPrices(
      amount.trim() === ''
        ? rest
        : [...rest, { variantId, amount, item: { id: variantId, title: label } }],
    )
  }

  // Render logic
  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const to = Math.min(total, page * PER_PAGE)
  const editable = tab === 'included' && currency !== null

  return (
    <DataCard title={copy.heading} subtitle={copy.help}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PillTabs
            variant="segmented"
            value={tab}
            onChange={handleTab}
            tabs={[
              { value: 'included' as Tab, label: copy.included },
              { value: 'excluded' as Tab, label: copy.excluded },
            ]}
          />
          <div className="relative w-full sm:w-64">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => handleQuery(e.target.value)}
              placeholder={copy.search}
              aria-label={copy.search}
              className="pl-8"
              autoComplete="off"
            />
          </div>
        </div>
        {failed ? (
          <p className="py-4 text-body text-destructive">{copy.failed}</p>
        ) : data === null ? (
          <div className="flex flex-col gap-2" role="status" aria-label={copy.loading}>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-4/5" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-4 text-body text-muted-foreground">
            {tab === 'included' ? copy.emptyIncluded : copy.emptyExcluded}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-body">
              <thead className="bg-muted/50 text-caption text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{copy.product}</th>
                  <th className="w-32 px-3 py-2 text-right font-medium">{copy.basePrice}</th>
                  {tab === 'included' ? (
                    <th className="w-40 px-3 py-2 text-right font-medium">{copy.catalogPrice}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.flatMap((p) =>
                  p.variants.map((v, i) => {
                    const sub = variantName(v.title, p.variants.length)
                    const label = sub ? `${p.title} · ${sub}` : p.title
                    const fixed = prices.find((x) => x.variantId === v.variantId)?.amount ?? ''
                    return (
                      <tr key={v.variantId}>
                        <td className="px-3 py-2">
                          <span className="flex min-w-0 items-center gap-3">
                            {i === 0 ? (
                              <ProductThumb url={p.imageUrl} />
                            ) : (
                              <span aria-hidden="true" className="w-8 shrink-0" />
                            )}
                            <span className="flex min-w-0 flex-col">
                              <span className={i === 0 ? 'truncate text-ink-strong' : 'sr-only'}>
                                {p.title}
                              </span>
                              {sub ? (
                                <span className="truncate text-caption text-muted-foreground">
                                  {sub}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {v.pricePaise === null ? copy.noPrice : fmt.money(v.pricePaise)}
                        </td>
                        {tab === 'included' ? (
                          <td className="px-3 py-2 text-right tabular-nums">
                            {editable ? (
                              <Input
                                inputMode="decimal"
                                aria-label={`${copy.catalogPrice}: ${label}`}
                                placeholder={copy.auto}
                                title={copy.autoHelp}
                                value={fixed}
                                disabled={disabled}
                                onChange={(e) => handleAmount(v.variantId, label, e.target.value)}
                                className="ml-auto w-32 text-right"
                              />
                            ) : v.pricePaise === null ? (
                              copy.noPrice
                            ) : (
                              fmt.money(adjusted(v.pricePaise))
                            )}
                          </td>
                        ) : null}
                      </tr>
                    )
                  }),
                )}
              </tbody>
            </table>
          </div>
        )}
        {total > PER_PAGE ? (
          <div className="flex items-center justify-end gap-2 text-caption text-muted-foreground">
            <span className="tabular-nums">{copy.page(from, to, total)}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((n) => n - 1)}
            >
              {copy.previous}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={to >= total}
              onClick={() => setPage((n) => n + 1)}
            >
              {copy.next}
            </Button>
          </div>
        ) : null}
      </div>
    </DataCard>
  )
}
