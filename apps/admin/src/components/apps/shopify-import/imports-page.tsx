'use client'

import { siteConfig } from '@commerce/config/site'
import { Settings, Store, Upload } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import BackgroundWorkNotice from '@/components/media/background-work-notice'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { shopifyImportContent } from '@/data/shopify-import'
import { shopifyImportSettingsContent } from '@/data/shopify-import-settings'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'
import RemainingCard from './remaining-card'
import RunStatusLabel from './run-status-label'
import StorageNotice from './storage-notice'
import { type RunListItem, totals } from './types'

const base = shopifyImportContent.base
const REFRESH_MS = 4000

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
              : r.status === 'running' || r.status === 'queued'
                ? all.home.progress(t.processed, t.total)
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
  const { card: settings } = useCopy(shopifyImportSettingsContent)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)
  const [data, setData] = useState<{ items: RunListItem[]; total: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const [shop, setShop] = useState<string | null | undefined>(undefined)

  // Refreshes every few seconds so running imports show their progress. The next request
  // waits for the last one, so a slow server never piles requests up.
  useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = () => {
      api.shopifyImport
        .runs({ page, perPage })
        .then((next) => {
          if (!live) return
          setData(next)
          setFailed(false)
        })
        .catch(() => {
          if (live) setFailed(true)
        })
        .finally(() => {
          if (live) timer = setTimeout(load, REFRESH_MS)
        })
    }
    load()
    return () => {
      live = false
      clearTimeout(timer)
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
    {
      icon: Settings,
      title: settings.title,
      body: settings.body,
      action: settings.action,
      href: `${base}/settings`,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <StorageNotice />
      <BackgroundWorkNotice />
      {shop === undefined ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <RemainingCard connected={shop !== null} />
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
        loading={data === null && !failed}
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
        empty={
          failed && data === null
            ? { heading: copy.loadFailed }
            : { heading: copy.empty.heading, body: copy.empty.body }
        }
      />
    </div>
  )
}
