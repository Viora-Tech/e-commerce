'use client'

import { siteConfig } from '@commerce/config/site'
import { PIXEL_EVENTS } from '@commerce/core/pixels'
import { useEffect, useState } from 'react'
import EventDialog from '@/components/apps/pixels/event-dialog'
import { type LogRow, logColumns } from '@/components/apps/pixels/log-columns'
import PageHeader from '@/components/layout/page-header'
import { appliedFromGroups, type FilterGroup } from '@/components/table/filter-panel'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { filterPanelContent } from '@/data/filter-panel'
import { pixelsContent } from '@/data/pixels'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Pixel = Awaited<ReturnType<typeof api.pixels.list>>[number]
type Status = 'sent' | 'failed' | 'skipped'
type Origin = 'storefront' | 'order' | 'test'
type EventName = (typeof PIXEL_EVENTS)[number]

const STATUSES: Status[] = ['sent', 'failed', 'skipped']
const ORIGINS: Origin[] = ['storefront', 'order', 'test']

/** Every event sent or skipped in the last 30 days, with Meta's answer one click away. */
export default function EventLogPage() {
  // Hooks
  const copy = useCopy(pixelsContent)
  const panelCopy = useCopy(filterPanelContent)
  const f = useFormat()
  const [pixels, setPixels] = useState<Pixel[]>([])
  const [rows, setRows] = useState<LogRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<Status | null>(null)
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [eventName, setEventName] = useState<string | null>(null)
  const [origin, setOrigin] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)
  const [open, setOpen] = useState<LogRow | null>(null)

  useEffect(() => {
    let cancelled = false
    api.pixels.list().then((list) => {
      if (!cancelled) setPixels(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    api.pixels.log
      .list({
        ...(status ? { status } : {}),
        ...(connectionId ? { connectionId } : {}),
        ...(eventName ? { eventName: eventName as EventName } : {}),
        ...(origin ? { origin: origin as Origin } : {}),
        limit: perPage,
        offset: (page - 1) * perPage,
      })
      .then((r) => {
        if (cancelled) return
        setRows(r.rows)
        setTotal(r.total)
      })
    return () => {
      cancelled = true
    }
  }, [status, connectionId, eventName, origin, page, perPage])

  // Helpers
  const pick = (set: (v: string | null) => void) => (next: string | null) => {
    set(next)
    setPage(1)
  }

  // Event handlers
  const handleStatus = (next: Status | null) => {
    setStatus(next)
    setPage(1)
  }
  const handlePerPage = (next: number) => {
    setPerPage(next)
    setPage(1)
  }
  const handleClearAll = () => {
    setQuery('')
    setStatus(null)
    setConnectionId(null)
    setEventName(null)
    setOrigin(null)
    setPage(1)
  }

  // Render logic
  const l = copy.log
  const names = new Map(pixels.map((p) => [p.id, p.name || p.pixelId]))
  const groups: FilterGroup[] = [
    {
      key: 'pixel',
      label: l.filters.pixel,
      type: 'select',
      options: pixels.map((p) => ({ value: p.id, label: p.name || p.pixelId })),
      value: connectionId,
      onChange: pick(setConnectionId),
      anyLabel: l.filters.allPixels,
    },
    {
      key: 'event',
      label: l.filters.event,
      type: 'select',
      options: PIXEL_EVENTS.map((e) => ({ value: e, label: copy.events[e] ?? e })),
      value: eventName,
      onChange: pick(setEventName),
      anyLabel: l.filters.allEvents,
    },
    {
      key: 'origin',
      label: l.filters.origin,
      type: 'select',
      options: ORIGINS.map((o) => ({ value: o, label: l.origins[o] ?? o })),
      value: origin,
      onChange: pick(setOrigin),
      anyLabel: l.filters.allOrigins,
    },
  ]
  const _applied = appliedFromGroups(groups, panelCopy)
  // The search box looks within this page (event id or order number).
  const needle = query.trim().toLowerCase()
  const visible = (rows ?? []).filter((r) => !needle || r.eventId.toLowerCase().includes(needle))

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={l.title} summary={l.subtitle} />
      <ResourceTable
        resourceName={l.resource}
        columns={logColumns(copy, f, names, setOpen)}
        items={visible}
        getId={(r) => r.id}
        selectable={false}
        loading={rows === null}
        query={query}
        onQueryChange={setQuery}
        onClearAll={handleClearAll}
        views={
          <ViewSelect
            value={status}
            onChange={handleStatus}
            options={[
              { value: null, label: l.tabs.all },
              ...STATUSES.map((s) => ({ value: s, label: l.tabs[s] })),
            ]}
          />
        }
        filterGroups={groups}
        page={page}
        perPage={perPage}
        total={total}
        onPageChange={setPage}
        onPerPageChange={handlePerPage}
        empty={{ heading: l.empty }}
      />
      <EventDialog
        row={open}
        pixelName={open ? (names.get(open.connectionId) ?? '') : ''}
        onClose={() => setOpen(null)}
      />
    </div>
  )
}
