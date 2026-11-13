'use client'

import { siteConfig } from '@commerce/config/site'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { notificationsSettingsContent } from '@/data/notifications'
import { whatsappAppContent } from '@/data/whatsapp-app'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Page = Awaited<ReturnType<typeof api.platformApps.whatsappMessages>>
type Row = Page['rows'][number]
type Status = 'sent' | 'failed' | 'queued' | null

const TONE: Record<string, ChipTone> = { sent: 'success', failed: 'danger', queued: 'attention' }

/**
 * Apps → WhatsApp → Messages: the WhatsApp side of the notification log every send writes
 * (message, number, order, status, Meta's error), newest first, 50 rows per fetch.
 */
export default function WhatsappMessagesPage() {
  // Hooks
  const appCopy = useCopy(whatsappAppContent)
  const settingsCopy = useCopy(notificationsSettingsContent)
  const [status, setStatus] = useState<Status>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [next, setNext] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let live = true
    setRows(null)
    api.platformApps
      .whatsappMessages(status ? { status } : {})
      .then((r) => {
        if (!live) return
        setRows(r.rows)
        setNext(r.next)
      })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : String(err)))
    return () => {
      live = false
    }
  }, [status])

  // Helpers
  const labelOf = (id: string) =>
    (settingsCopy.messages as Record<string, { name: string }>)[id]?.name ?? id

  // Event handlers
  const handleStatus = (value: Status) => {
    setStatus(value)
    setPage(1)
  }
  const handleQuery = (value: string) => {
    setQuery(value)
    setPage(1)
  }
  const handlePerPage = (value: number) => {
    setPerPage(value)
    setPage(1)
  }
  const handleMore = async () => {
    if (!next) return
    setLoadingMore(true)
    try {
      const r = await api.platformApps.whatsappMessages({
        before: next,
        ...(status ? { status } : {}),
      })
      setRows((prev) => [...(prev ?? []), ...r.rows])
      setNext(r.next)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingMore(false)
    }
  }

  // Render logic
  const copy = appCopy.messages
  const columns: ResourceColumnSpec<Row>[] = [
    {
      id: 'message',
      title: copy.columns.message,
      hideable: false,
      align: 'start',
      sortValue: (r) => labelOf(r.template),
      render: (r) => <span className="font-medium">{labelOf(r.template)}</span>,
    },
    {
      id: 'to',
      title: copy.columns.to,
      align: 'start',
      sortValue: (r) => r.to,
      render: (r) => <span className="tabular-nums">{r.to}</span>,
    },
    {
      id: 'order',
      title: copy.columns.order,
      align: 'start',
      sortValue: (r) => r.orderNumber ?? 0,
      render: (r) => (r.orderNumber != null ? `#${r.orderNumber}` : '—'),
    },
    {
      id: 'status',
      title: copy.columns.status,
      sortValue: (r) => r.status,
      render: (r) => (
        <StatusChip tone={TONE[r.status] ?? 'neutral'}>
          {copy.status[r.status] ?? r.status}
        </StatusChip>
      ),
    },
    {
      id: 'error',
      title: copy.columns.error,
      align: 'start',
      sortValue: (r) => r.error ?? '',
      render: (r) =>
        r.error ? (
          <span
            className="line-clamp-2 max-w-[24rem] text-caption text-destructive"
            title={r.error}
          >
            {r.error}
          </span>
        ) : null,
    },
    {
      id: 'sent',
      title: copy.columns.sent,
      sortValue: (r) => new Date(r.createdAt),
      render: (r) => <RelativeTime value={r.createdAt} />,
    },
  ]
  const needle = query.trim().toLowerCase()
  const matching = (rows ?? []).filter(
    (r) =>
      !needle ||
      labelOf(r.template).toLowerCase().includes(needle) ||
      r.to.includes(needle) ||
      String(r.orderNumber ?? '').includes(needle.replace('#', '')),
  )
  const visible = matching.slice((page - 1) * perPage, page * perPage)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={copy.title} summary={copy.intro} />
      <ResourceTable
        resourceName={copy.resource}
        columns={columns}
        items={visible}
        getId={(r) => r.id}
        href={(r) => (r.orderId ? routes.orders.detail(r.orderId) : '')}
        selectable={false}
        loading={rows === null}
        query={query}
        onQueryChange={handleQuery}
        views={
          <ViewSelect<Status>
            value={status}
            onChange={handleStatus}
            options={[
              { value: null, label: copy.filter.all },
              { value: 'sent', label: copy.filter.sent },
              { value: 'failed', label: copy.filter.failed },
              { value: 'queued', label: copy.filter.queued },
            ]}
          />
        }
        page={page}
        perPage={perPage}
        total={matching.length}
        onPageChange={setPage}
        onPerPageChange={handlePerPage}
        empty={{ heading: copy.empty }}
      />
      {next ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={handleMore} disabled={loadingMore}>
            {copy.more}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
