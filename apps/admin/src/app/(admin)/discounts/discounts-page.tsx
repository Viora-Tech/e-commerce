'use client'

import { siteConfig } from '@commerce/config/site'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useRef, useState } from 'react'
import DiscountBulkActions from '@/components/discounts/discount-bulk-actions'
import { discountColumns } from '@/components/discounts/discount-columns'
import DiscountRowMenu from '@/components/discounts/discount-row-menu'
import DiscountTiles, { type DiscountStats } from '@/components/discounts/discount-tiles'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { DISCOUNT_LIFECYCLES, type DiscountLifecycle, discountsContent } from '@/data/discounts'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { type ListQuery, sameListQuery } from '@/lib/list-query'
import { usePrimaryAction } from '@/lib/primary-action'
import { routes } from '@/lib/routes'

type ListResult = Awaited<ReturnType<typeof api.discounts.list>>

/** First page, tiles and the all-discounts count rendered on the server so nothing paints empty. */
export type DiscountsInitial = {
  query: ListQuery<DiscountLifecycle>
  result: ListResult
  stats: DiscountStats
  allCount: number
}

const DEFAULT_PER_PAGE = siteConfig.ui.rowsPerPage.default

function DiscountsContent({ initial }: { initial: DiscountsInitial }) {
  // Hooks
  const copy = useCopy(discountsContent)
  const fmt = useFormat()
  usePrimaryAction(routes.discounts.new())
  const [{ page, perPage, query, status }, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(DEFAULT_PER_PAGE),
      status: parseAsStringLiteral(DISCOUNT_LIFECYCLES),
    },
    { shallow: true },
  )
  const [items, setItems] = useState(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)
  /** Bumped by a row's menu after a pause, resume or delete, so the page re-reads its rows. */
  const [reload, setReload] = useState(0)
  const hydrated = useRef(false)

  useEffect(() => {
    // The server's first page is used once; after any change (including back to the first
    // tab) the list is fetched again, so it never keeps another tab's rows.
    const firstRun = !hydrated.current
    hydrated.current = true
    if (
      reload === 0 &&
      firstRun &&
      sameListQuery({ page, query, status }, initial.query) &&
      perPage === DEFAULT_PER_PAGE
    )
      return
    let cancelled = false
    setLoading(true)
    api.discounts
      .list({ page, perPage, search: query || undefined, lifecycle: status ?? undefined })
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, perPage, query, status, initial.query, reload])

  // Render logic
  const { stats } = initial

  return (
    <ProoflyListPage
      title={copy.title}
      summary={copy.summary(stats.active, stats.scheduled, stats.usedThisMonth)}
      stats={
        <DiscountTiles
          stats={stats}
          status={status}
          onSelect={(next) => setQ({ status: next, page: 1 })}
        />
      }
      actions={
        <Tooltip>
          <TooltipTrigger
            render={
              <Button render={<Link href={routes.discounts.new()} />} nativeButton={false}>
                <Plus strokeWidth={1.6} />
                {copy.create}
              </Button>
            }
          />
          <TooltipContent>
            {copy.create} <Kbd>N</Kbd>
          </TooltipContent>
        </Tooltip>
      }
    >
      <ResourceTable
        resourceName={copy.resource}
        columns={discountColumns(copy, fmt)}
        items={items}
        getId={(d) => d.id}
        href={(d) => routes.discounts.detail(d.id)}
        rowActions={(d) => (
          <DiscountRowMenu discount={d} onChanged={() => setReload((n) => n + 1)} />
        )}
        loading={loading}
        query={query}
        onQueryChange={(next) => setQ({ query: next, page: 1 })}
        onClearAll={() => setQ({ query: '', status: null, page: 1 })}
        views={
          <ViewSelect
            value={status}
            onChange={(next) => setQ({ status: next, page: 1 })}
            options={[
              { value: null, label: copy.tabs.all, count: initial.allCount },
              ...DISCOUNT_LIFECYCLES.map((s) => ({
                value: s,
                label: copy.tabs[s],
                count: s === 'disabled' ? undefined : stats[s],
              })),
            ]}
          />
        }
        page={page}
        perPage={perPage}
        onPerPageChange={(next) => setQ({ perPage: next, page: 1 })}
        total={total}
        onPageChange={(next) => setQ({ page: next })}
        selectable
        bulkActions={(ids, clear) => (
          <DiscountBulkActions ids={ids} clear={clear} onChanged={() => setReload((n) => n + 1)} />
        )}
        empty={{
          heading: copy.empty.heading,
          body: copy.empty.body,
          action: (
            <Button render={<Link href={routes.discounts.new()} />} nativeButton={false}>
              <Plus />
              {copy.create}
            </Button>
          ),
        }}
      />
    </ProoflyListPage>
  )
}

export default function DiscountsPage({ initial }: { initial: DiscountsInitial }) {
  return (
    <Suspense>
      <DiscountsContent initial={initial} />
    </Suspense>
  )
}
