'use client'

import type { DataRequestRow, PrivacyAuditEntry } from '@commerce/core'
import { daysUntilDue, requestUrgency } from '@commerce/core/privacy'
import { ShieldCheck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import AuditTrail from '@/components/privacy/audit-trail'
import DataRequestActions from '@/components/privacy/data-request-actions'
import DataRequestStatusBadge from '@/components/privacy/data-request-status-badge'
import {
  dataRequestDetailContent as copy,
  dataRequestsContent,
  KIND_LABEL,
  SOURCE_LABEL,
  URGENCY_LABEL,
} from '@/data/customer-privacy'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/format-date'

type DataRequestDetailProps = { id: string }

type Detail = {
  request: DataRequestRow & {
    customer: {
      id: string
      name: string | null
      email: string | null
      anonymisedAt: Date | null
    } | null
  }
  audit: PrivacyAuditEntry[]
}

type RowProps = { label: string; value: string | null | undefined }

/** One request: who asked for what, what to do next, and everything done so far. */
export default function DataRequestDetail({ id }: DataRequestDetailProps) {
  // Hooks
  const [detail, setDetail] = useState<Detail | null>(null)
  const [failed, setFailed] = useState(false)

  const [reload, setReload] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` re-fetches after an action
  useEffect(() => {
    api.customerPrivacy
      .request({ id })
      .then(setDetail)
      .catch(() => setFailed(true))
  }, [id, reload])

  // Early returns
  if (failed) return <p className="text-body text-muted-foreground">{copy.loadFailed}</p>
  if (!detail) return <Skeleton className="h-96 w-full rounded-2xl" />

  // Render logic
  const r = detail.request
  const dueAt = new Date(r.dueAt)
  const urgency = requestUrgency({ status: r.status, dueAt }, new Date())
  const due =
    urgency === 'closed'
      ? formatDate(dueAt)
      : `${formatDate(dueAt)} (${URGENCY_LABEL[urgency](daysUntilDue(dueAt, new Date()))})`
  const cu = r.customer

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.title(r.number)}
        subtitle={KIND_LABEL[r.kind]}
        icon={<ShieldCheck aria-hidden="true" />}
        breadcrumbs={[
          { label: copy.back, href: '/settings/privacy/requests' },
          { label: copy.title(r.number) },
        ]}
        badges={<DataRequestStatusBadge status={r.status} />}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          <DataRequestActions request={r} customer={cu} onChanged={() => setReload((n) => n + 1)} />
          <DataCard title={copy.trail}>
            <AuditTrail entries={detail.audit} />
          </DataCard>
        </div>
        <div className="flex flex-col gap-4">
          <DataCard title={copy.customer}>
            {cu ? (
              <div className="flex flex-col gap-2">
                <p className="text-body">
                  {cu.anonymisedAt ? dataRequestsContent.erasedCustomer : (cu.name ?? cu.email)}
                </p>
                {cu.anonymisedAt ? (
                  <p className="text-caption text-muted-foreground">{copy.erased}</p>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    render={<Link href={`/customers/${cu.id}`} />}
                    nativeButton={false}
                  >
                    {copy.openCustomer}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-body text-muted-foreground">{copy.noCustomer}</p>
            )}
          </DataCard>
          <DataCard title={copy.details}>
            <dl className="flex flex-col gap-3">
              <Row label={copy.kind} value={KIND_LABEL[r.kind]} />
              <Row label={copy.source} value={SOURCE_LABEL[r.source]} />
              <Row label={copy.received} value={formatDate(new Date(r.createdAt))} />
              <Row label={copy.due} value={due} />
              <Row
                label={copy.contact}
                value={[r.contactEmail, r.contactPhone].filter(Boolean).join(' · ') || null}
              />
              <Row label={copy.note} value={r.note} />
              <Row label={copy.resolution} value={r.resolution} />
            </dl>
          </DataCard>
        </div>
      </div>
    </div>
  )
}

/* A label over its value; nothing when the value is empty. */
function Row({ label, value }: RowProps) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-eyebrow">{label}</dt>
      <dd className="whitespace-pre-line text-body">{value}</dd>
    </div>
  )
}
