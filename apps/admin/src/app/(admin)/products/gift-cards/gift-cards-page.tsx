'use client'

import { siteConfig } from '@commerce/config/site'
import { maskedGiftCardCode } from '@commerce/core/gift-cards'
import { Gift, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useRef, useState } from 'react'
import GiftCardProductDialog from '@/components/gift-cards/gift-card-product-dialog'
import GiftCardProductsCard from '@/components/gift-cards/gift-card-products-card'
import GiftCardRowMenu from '@/components/gift-cards/gift-card-row-menu'
import GiftCardSettingsCard from '@/components/gift-cards/gift-card-settings-card'
import GiftCardStateTabs from '@/components/gift-cards/gift-card-state-tabs'
import GiftCardTiles from '@/components/gift-cards/gift-card-tiles'
import GiftCardsBulkActions from '@/components/gift-cards/gift-cards-bulk-actions'
import EmptyState from '@/components/layout/empty-state'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import RelativeTime from '@/components/layout/relative-time'
import OrderChip from '@/components/orders/order-chip'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { filterPanelContent } from '@/data/filter-panel'
import { GIFT_CARD_STATES, type GiftCardStateFilter, giftCardsContent } from '@/data/gift-cards'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import {
  CLEAR_GIFT_CARD_FILTERS,
  GIFT_CARD_FILTER_PARAMS,
  type GiftCardFilters,
  giftCardFilterGroups,
  giftCardFilterInput,
  hasGiftCardFilters,
} from '@/lib/gift-card-list-filters'
import { type ListQuery, sameListQuery } from '@/lib/list-query'
import { formatPaise } from '@/lib/money'
import { usePrimaryAction } from '@/lib/primary-action'
import { routes } from '@/lib/routes'

type ListResult = Awaited<ReturnType<typeof api.giftCards.list>>
type Item = ListResult['rows'][number]
type Products = Awaited<ReturnType<typeof api.giftCards.products>>
type Settings = Awaited<ReturnType<typeof api.giftCards.settings>>
type Query = ListQuery<GiftCardStateFilter>

export type GiftCardsInitial = {
  query: Query
  result: ListResult
  allCount: number
  products: Products
  settings: Settings
}

const copy = giftCardsContent
const PER_PAGE = siteConfig.ui.rowsPerPage.default

/** `expiresOn` is a bare `YYYY-MM-DD`: read as local midnight so the day never shifts. */
const asDate = (d: Date | string) =>
  typeof d === 'string' && d.length === 10 ? new Date(`${d}T00:00:00`) : new Date(d)

function fetchCards(q: Query & GiftCardFilters & { perPage: number }) {
  return api.giftCards.list({
    page: q.page,
    perPage: q.perPage,
    q: q.query || undefined,
    state: q.status ?? undefined,
    ...giftCardFilterInput(q),
  })
}

function CustomerCell({ item }: { item: Item }) {
  const name = item.customerName || item.recipientName
  const email = item.customerEmail || item.recipientEmail
  if (!name && !email) return <span className="text-muted-foreground">{copy.noCustomer}</span>
  return (
    <span className="flex flex-col text-left">
      <span className="text-body text-foreground">{name || email}</span>
      {name && email ? <span className="text-caption text-muted-foreground">{email}</span> : null}
    </span>
  )
}

const columns: ResourceColumnSpec<Item>[] = [
  {
    id: 'code',
    title: copy.columns.code,
    hideable: false,
    align: 'start',
    className: 'w-40 px-3',
    render: (g) => (
      <span className="font-mono text-body-strong tracking-wide">
        {maskedGiftCardCode(g.lastCharacters)}
      </span>
    ),
  },
  {
    id: 'customer',
    title: copy.columns.customer,
    align: 'start',
    className: 'w-60 whitespace-normal',
    render: (g) => <CustomerCell item={g} />,
  },
  {
    id: 'source',
    title: copy.columns.source,
    render: (g) =>
      g.source === 'purchase' ? copy.source.purchase(g.orderNumber) : copy.source.manual,
  },
  {
    id: 'issued',
    title: copy.columns.issued,
    sortValue: (g) => new Date(g.createdAt).getTime(),
    render: (g) => <RelativeTime value={g.createdAt} />,
  },
  {
    id: 'expires',
    title: copy.columns.expires,
    sortValue: (g) => g.expiresOn ?? '9999',
    render: (g) =>
      g.expiresOn ? (
        <RelativeTime value={asDate(g.expiresOn)} />
      ) : (
        <span className="text-muted-foreground-soft">{copy.never}</span>
      ),
  },
  {
    id: 'balance',
    title: copy.columns.balance,
    sortValue: (g) => g.balancePaise,
    render: (g) => (
      <span className="tabular-nums">
        {copy.balanceOf(formatPaise(g.balancePaise), formatPaise(g.initialValuePaise))}
      </span>
    ),
  },
  {
    id: 'status',
    title: copy.columns.status,
    render: (g) => <OrderChip kind="giftCard" value={g.state} />,
  },
]

function GiftCardsContent({ initial }: { initial: GiftCardsInitial }) {
  // Hooks
  usePrimaryAction(routes.products.newGiftCard())
  const _panelCopy = useCopy(filterPanelContent)
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(PER_PAGE),
      status: parseAsStringLiteral(GIFT_CARD_STATES),
      ...GIFT_CARD_FILTER_PARAMS,
    },
    { shallow: true },
  )
  const [result, setResult] = useState<ListResult>(initial.result)
  const [products, setProducts] = useState<Products>(initial.products)
  const [loading, setLoading] = useState(false)
  const [productOpen, setProductOpen] = useState(false)
  const hydrated = useRef(false)

  useEffect(() => {
    // The server's first page is used once; after any change (including back to the first
    // tab) the list is fetched again, so it never keeps another tab's rows.
    const firstRun = !hydrated.current
    hydrated.current = true
    if (
      firstRun &&
      sameListQuery({ page: q.page, query: q.query, status: q.status }, initial.query) &&
      q.perPage === PER_PAGE &&
      !hasGiftCardFilters(q)
    )
      return
    let cancelled = false
    setLoading(true)
    fetchCards(q)
      .then((r) => !cancelled && setResult(r))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [q, initial.query])

  // Helpers
  const refresh = async () => {
    setResult(await fetchCards(q))
  }

  // Event handlers
  const handleProductCreated = async () => {
    setProducts(await api.giftCards.products())
  }

  // Render logic
  const fresh = initial.allCount === 0 && products.length === 0
  const groups = giftCardFilterGroups(q, copy.filters, (patch) => setQ({ ...patch, page: 1 }))
  const actions = (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={() => setProductOpen(true)}>
        <Plus strokeWidth={1.6} aria-hidden="true" />
        {copy.addProduct}
      </Button>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size="lg"
              render={<Link href={routes.products.newGiftCard()} />}
              nativeButton={false}
            >
              <Plus strokeWidth={1.6} />
              {copy.create}
            </Button>
          }
        />
        <TooltipContent>
          {copy.create} <Kbd>N</Kbd>
        </TooltipContent>
      </Tooltip>
    </div>
  )

  return (
    <ProoflyListPage
      title={copy.heading}
      summary={copy.summary}
      actions={fresh ? null : actions}
      stats={
        fresh ? undefined : (
          <GiftCardTiles
            activeCount={result.activeCount}
            outstandingPaise={result.outstandingPaise}
            products={products}
          />
        )
      }
    >
      {fresh ? (
        <Card className="py-6">
          <EmptyState
            heading={copy.start.heading}
            body={copy.start.body}
            icon={Gift}
            action={actions}
          />
        </Card>
      ) : (
        <ResourceTable
          resourceName={copy.resource}
          columns={columns}
          items={result.rows}
          getId={(g) => g.id}
          href={(g) => routes.products.giftCard(g.id)}
          rowActions={(g) => <GiftCardRowMenu card={g} onChanged={() => void refresh()} />}
          bulkActions={(ids, clear) => (
            <GiftCardsBulkActions
              ids={ids}
              onDone={() => {
                clear()
                void refresh()
              }}
            />
          )}
          loading={loading}
          query={q.query}
          onQueryChange={(query) => setQ({ query, page: 1 }, { history: 'replace' })}
          onClearAll={() => setQ({ ...CLEAR_GIFT_CARD_FILTERS, query: '', status: null, page: 1 })}
          filterGroups={groups}
          views={
            <GiftCardStateTabs
              value={q.status}
              allCount={initial.allCount}
              onChange={(s) => setQ({ status: s, page: 1 })}
            />
          }
          page={q.page}
          perPage={q.perPage}
          onPerPageChange={(next) => setQ({ perPage: next, page: 1 })}
          total={result.total}
          onPageChange={(page) => setQ({ page })}
          empty={copy.empty}
        />
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <GiftCardProductsCard products={products} onAdd={() => setProductOpen(true)} />
        <GiftCardSettingsCard initial={initial.settings} />
      </div>
      <p className="text-caption text-muted-foreground">{copy.voucherNote}</p>
      <GiftCardProductDialog
        open={productOpen}
        onOpenChange={setProductOpen}
        onCreated={handleProductCreated}
      />
    </ProoflyListPage>
  )
}

export default function GiftCardsPage({ initial }: { initial: GiftCardsInitial }) {
  return (
    <Suspense>
      <GiftCardsContent initial={initial} />
    </Suspense>
  )
}
