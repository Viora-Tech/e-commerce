'use client'

import { siteConfig } from '@commerce/config/site'
import { Store, Upload } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import PageHeader from '@/components/layout/page-header'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'
import RemainingCard from './remaining-card'
import RunStatusLabel from './run-status-label'
import { type RunListItem, totals } from './types'

const base = shopifyImportContent.base

const columnsFor = (
  all: typeof shopifyImportContent,
  fmt: Formatters,
): ResourceColumnSpec<RunListItem>[] => [
  {
    id: 'started',
    title: all.home.columns.started,
    hideable: false,
    render: (r) => (
      <span className="font-medium text-ink-strong tabular-nums">{fmt.dateTime(r.createdAt)}</span>
    ),
  },
  {
    id: 'source',
    title: all.home.columns.source,
    render: (r) => (
      <span className="text-muted-foreground">
        {r.mode === 'csv' ? all.home.source.csv(r.fileName) : all.home.source.api}
      </span>
    ),
  },
  {
    id: 'what',
    title: all.home.columns.what,
    align: 'start',
    // The list can be long ("Products, Collections, …"); let it wrap instead of running
    // under the Status column.
    className: 'min-w-[14rem] max-w-[24rem] whitespace-normal',
    render: (r) => (
      <span className="line-clamp-2">{r.resources.map((x) => all.resources[x]).join(', ')}</span>
    ),
  },
  {
    id: 'status',
    title: all.home.columns.status,
    className: 'whitespace-nowrap',
    render: (r) => <RunStatusLabel status={r.status} preview={r.dryRun} />,
  },
  {
    id: 'result',
    title: all.home.columns.result,
    align: 'end',
    render: (r) => {
      const t = totals(r.progress)
      return (
        <span className="line-clamp-2 text-muted-foreground tabular-nums">
          {r.status === 'completed'
            ? all.home.result(t.created, t.updated, t.failed)
            : r.status === 'failed'
              ? (r.error ?? all.home.failedNoReason)
              : null}
        </span>
      )
    },
  },
]

/** App root: the two ways in, and every import so far. */
export default function ImportsPage() {
  // Hooks
  const all = useCopy(shopifyImportContent)
  const fmt = useFormat()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)
  const [data, setData] = useState<{ items: RunListItem[]; total: number } | null>(null)
  const [shop, setShop] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let live = true
    const load = () =>
      api.shopifyImport.runs({ page, perPage }).then((next) => {
        if (live) setData(next)
      })
    load().catch(() => {})
    // Refresh while anything is still in flight.
    const timer = setInterval(() => {
      load().catch(() => {})
    }, 4000)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [page, perPage])

  useEffect(() => {
    api.shopifyImport
      .connection()
      .then((c) => setShop(c?.shopName ?? c?.shopDomain ?? null))
      .catch(() => setShop(null))
  }, [])

  // Render logic
  const copy = all.home
  const columns = columnsFor(all, fmt)
  const ways = [
    {
      icon: Upload,
      title: copy.csvTitle,
      body: copy.csvBody,
      action: copy.csvAction,
      href: `${base}/csv`,
    },
    {
      icon: Store,
      title: shop ? copy.apiConnected(shop) : copy.apiTitle,
      body: copy.apiBody,
      action: copy.apiAction,
      href: `${base}/connect`,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      <RemainingCard connected={shop !== null} />
      <div className="grid gap-4 md:grid-cols-2">
        {ways.map((way) => (
          <Card key={way.href}>
            <CardContent className="flex h-full flex-col items-start gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-ink-strong">
                <way.icon className="size-4.5" aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="font-semibold text-ink-strong">{way.title}</h2>
                <p className="text-body text-muted-foreground">{way.body}</p>
              </div>
              <Button
                variant="outline"
                className="mt-auto"
                nativeButton={false}
                render={<Link href={way.href} />}
              >
                {way.action}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <h2 className="mt-2 font-semibold text-ink-strong">{copy.historyTitle}</h2>
      <ResourceTable
        resourceName={{ singular: 'import', plural: 'imports' }}
        columns={columns}
        items={data?.items ?? []}
        getId={(r) => r.id}
        href={(r) => `${base}/runs/${r.id}`}
        loading={data === null}
        query=""
        onQueryChange={() => {}}
        page={page}
        perPage={perPage}
        onPerPageChange={(next) => {
          setPerPage(next)
          setPage(1)
        }}
        total={data?.total ?? 0}
        onPageChange={setPage}
        selectable={false}
        empty={{ heading: copy.empty.heading, body: copy.empty.body }}
      />
    </div>
  )
}
