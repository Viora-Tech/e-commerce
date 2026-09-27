'use client'

import { Store, Upload } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import PageHeader from '@/components/layout/page-header'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { shopifyImportContent } from '@/data/shopify-import'
import { api } from '@/lib/api-client'
import RunStatusLabel from './run-status-label'
import { type RunListItem, totals } from './types'

const copy = shopifyImportContent.home
const base = shopifyImportContent.base
const PER_PAGE = 20

const columns: ResourceColumnSpec<RunListItem>[] = [
  {
    id: 'started',
    title: copy.columns.started,
    hideable: false,
    render: (r) => (
      <span className="font-medium text-ink-strong tabular-nums">
        {new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
      </span>
    ),
  },
  {
    id: 'source',
    title: copy.columns.source,
    render: (r) => (
      <span className="text-muted-foreground">
        {r.mode === 'csv' ? copy.source.csv(r.fileName) : copy.source.api}
      </span>
    ),
  },
  {
    id: 'what',
    title: copy.columns.what,
    align: 'start',
    // The list can be long ("Products, Collections, …"); let it wrap instead of running
    // under the Status column.
    className: 'min-w-[14rem] max-w-[24rem] whitespace-normal',
    render: (r) => (
      <span className="line-clamp-2">
        {r.resources.map((x) => shopifyImportContent.resources[x]).join(', ')}
      </span>
    ),
  },
  {
    id: 'status',
    title: copy.columns.status,
    className: 'whitespace-nowrap',
    render: (r) => <RunStatusLabel status={r.status} preview={r.dryRun} />,
  },
  {
    id: 'result',
    title: copy.columns.result,
    align: 'end',
    render: (r) => {
      const t = totals(r.progress)
      return (
        <span className="line-clamp-2 text-muted-foreground tabular-nums">
          {r.status === 'completed'
            ? copy.result(t.created, t.updated, t.failed)
            : r.status === 'failed'
              ? (r.error ?? copy.failedNoReason)
              : null}
        </span>
      )
    },
  },
]

/** App root: the two ways in, and every import so far. */
export default function ImportsPage() {
  // Hooks
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ items: RunListItem[]; total: number } | null>(null)
  const [shop, setShop] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    const load = () =>
      api.shopifyImport.runs({ page, perPage: PER_PAGE }).then((next) => {
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
  }, [page])

  useEffect(() => {
    api.shopifyImport
      .connection()
      .then((c) => setShop(c?.shopName ?? c?.shopDomain ?? null))
      .catch(() => {})
  }, [])

  // Render logic
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
        perPage={PER_PAGE}
        total={data?.total ?? 0}
        onPageChange={setPage}
        selectable={false}
        empty={{ heading: copy.empty.heading, body: copy.empty.body }}
      />
    </div>
  )
}
