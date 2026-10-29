'use client'

import { siteConfig } from '@commerce/config/site'
import type { RolloutHold } from '@commerce/core'
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
import {
  appliedFromGroups,
  clearGroups,
  FILTER_PANEL_CLASS,
  FilterPanel,
} from '@/components/table/filter-panel'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { DISCOUNT_LIFECYCLES, type DiscountLifecycle, discountsContent } from '@/data/discounts'
import { filterPanelContent } from '@/data/filter-panel'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import {
  CLEAR_DISCOUNT_FILTERS,
  DISCOUNT_FILTER_PARAMS,
  discountFilterGroups,
  discountFilterInput,
  hasDiscountFilters,
} from '@/lib/discount-list-filters'
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
  /** The unended rollout that switches each discount, by id; empty without Rollouts: read. */
  holds: Record<string, RolloutHold>
}

const DEFAULT_PER_PAGE = siteConfig.ui.rowsPerPage.default

function DiscountsContent({ initial }: { initial: DiscountsInitial }) {
  // Hooks
  const copy = useCopy(discountsContent)
  const panelCopy = useCopy(filterPanelContent)
  const fmt = useFormat()
  usePrimaryAction(routes.discounts.new())
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(DEFAULT_PER_PAGE),
      status: parseAsStringLiteral(DISCOUNT_LIFECYCLES),
      ...DISCOUNT_FILTER_PARAMS,
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
      sameListQuery({ page: q.page, query: q.query, status: q.status }, initial.query) &&
      q.perPage === DEFAULT_PER_PAGE &&
      !hasDiscountFilters(q)
    )
      return
    let cancelled = false
    setLoading(true)
    api.discounts
      .list({
        page: q.page,
        perPage: q.perPage,
        search: q.query || undefined,
        lifecycle: q.status ?? undefined,
        ...discountFilterInput(q),
      })
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [q, initial.query, reload])

  // Render logic
  const { stats } = initial
  const groups = discountFilterGroups(q, copy.filters, (patch) => setQ({ ...patch, page: 1 }))
  const applied = appliedFromGroups(groups, panelCopy)
  const filtered = applied.length > 0 || q.query.length > 0

  return (
    <ProoflyListPage
      title={copy.title}
      summary={copy.summary(stats.active, stats.scheduled, stats.usedThisMonth)}
      stats={
        <DiscountTiles
          stats={stats}
          status={q.status}
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
        columns={discountColumns(copy, fmt, initial.holds)}
        items={items}
        getId={(d) => d.id}
        href={(d) => routes.discounts.detail(d.id)}
        rowActions={(d) => (
          <DiscountRowMenu discount={d} onChanged={() => setReload((n) => n + 1)} />
        )}
        loading={loading}
        query={q.query}
        onQueryChange={(next) => setQ({ query: next, page: 1 })}
        onClearAll={() => setQ({ ...CLEAR_DISCOUNT_FILTERS, query: '', status: null, page: 1 })}
        filters={(close) => (
          <FilterPanel
            groups={groups}
            onClear={() => clearGroups(groups)}
            footer={{ label: panelCopy.show(total), onDone: close }}
          />
        )}
        filtersClassName={FILTER_PANEL_CLASS}
        applied={applied}
        views={
          <ViewSelect
            value={q.status}
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
        page={q.page}
        perPage={q.perPage}
        onPerPageChange={(next) => setQ({ perPage: next, page: 1 })}
        total={total}
        onPageChange={(next) => setQ({ page: next })}
        selectable
        bulkActions={(ids, clear) => (
          <DiscountBulkActions ids={ids} clear={clear} onChanged={() => setReload((n) => n + 1)} />
        )}
        empty={
          filtered
            ? copy.noResults
            : {
                heading: copy.empty.heading,
                body: copy.empty.body,
                action: (
                  <Button render={<Link href={routes.discounts.new()} />} nativeButton={false}>
                    <Plus />
                    {copy.create}
                  </Button>
                ),
              }
        }
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
