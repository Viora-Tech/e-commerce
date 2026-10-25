'use client'

import type { DataRequestListItem } from '@commerce/core'
import { daysUntilDue, requestUrgency } from '@commerce/core/privacy'
import { Plus, ShieldCheck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import StatusChip from '@/components/layout/status-chip'
import DataRequestStatusBadge from '@/components/privacy/data-request-status-badge'
import LogRequestDialog from '@/components/privacy/log-request-dialog'
import {
  dataRequestsContent as copy,
  KIND_LABEL,
  SOURCE_LABEL,
  URGENCY_LABEL,
} from '@/data/customer-privacy'
import { api } from '@/lib/api-client'

type Tab = 'open' | 'closed' | 'all'

const URGENCY_VARIANT = {
  overdue: 'danger',
  due_soon: 'attention',
  on_track: 'neutral',
  closed: 'neutral',
} as const

const TABS: Tab[] = ['open', 'closed', 'all']

const isTab = (v: unknown): v is Tab => typeof v === 'string' && (TABS as string[]).includes(v)

/** The data request queue: open work first, soonest due at the top. */
export default function DataRequestQueue() {
  // Hooks
  const [tab, setTab] = useState<Tab>('open')
  const [rows, setRows] = useState<DataRequestListItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [logging, setLogging] = useState(false)
  const [reload, setReload] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` re-fetches after logging a request
  useEffect(() => {
    setRows(null)
    api.customerPrivacy
      .requests({ status: tab })
      .then(setRows)
      .catch(() => setFailed(true))
  }, [tab, reload])

  // Render logic
  const now = new Date()

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        back={{ label: copy.back, href: '/settings/privacy' }}
        actions={
          <Button onClick={() => setLogging(true)}>
            <Plus aria-hidden="true" />
            {copy.log}
          </Button>
        }
        lead={{ kind: 'icon', node: <ShieldCheck aria-hidden="true" /> }}
      />
      <Tabs value={tab} onValueChange={(v) => isTab(v) && setTab(v)}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {copy.tabs[t]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {failed ? (
        <p className="text-body text-muted-foreground">{copy.loadFailed}</p>
      ) : !rows ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState variant="plain" size="lg" body={copy.empty[tab]} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {rows.map((r) => {
                const dueAt = new Date(r.dueAt)
                const urgency = requestUrgency({ status: r.status, dueAt }, now)
                return (
                  <li key={r.id}>
                    <Link
                      href={`/settings/privacy/requests/${r.id}`}
                      className="flex flex-col gap-2 px-4 py-3 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-body font-medium">
                          {copy.number(r.number)} · {KIND_LABEL[r.kind]}
                        </span>
                        <span className="truncate text-caption text-muted-foreground">
                          {r.customerName ??
                            r.contactEmail ??
                            r.contactPhone ??
                            copy.unknownCustomer}
                          {' · '}
                          {SOURCE_LABEL[r.source]}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <DataRequestStatusBadge status={r.status} />
                        {urgency === 'closed' ? null : (
                          <StatusChip tone={URGENCY_VARIANT[urgency]}>
                            {URGENCY_LABEL[urgency](daysUntilDue(dueAt, now))}
                          </StatusChip>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}
      <LogRequestDialog
        open={logging}
        onClose={() => setLogging(false)}
        onLogged={() => {
          setLogging(false)
          setTab('open')
          setReload((n) => n + 1)
        }}
      />
    </div>
  )
}
