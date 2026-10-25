'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { AppPageProps } from '@/apps/registry'
import AffiliateProgramCard from '@/components/apps/affiliates/affiliate-program-card'
import AffiliateRowActions from '@/components/apps/affiliates/affiliate-row-actions'
import CodesCard from '@/components/apps/affiliates/codes-card'
import { commissionColumns } from '@/components/apps/affiliates/commission-columns'
import ReviewCard from '@/components/apps/affiliates/review-card'
import { statusTone } from '@/components/apps/affiliates/tones'
import PageHeader from '@/components/layout/page-header'
import StatStrip from '@/components/layout/stat-strip'
import StatusChip from '@/components/layout/status-chip'
import ResourceTable from '@/components/table/resource-table'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Detail = Awaited<ReturnType<typeof api.affiliates.get>>

/** One affiliate: their link and code, figures, application, payout details and commissions. */
export default function AffiliateDetail({ params }: AppPageProps) {
  // Hooks
  const copy = useCopy(affiliatesContent)
  const f = useFormat()
  const [data, setData] = useState<Detail | null>(null)
  const [note, setNote] = useState('')
  const [reload, setReload] = useState(0)
  const [origin, setOrigin] = useState('')

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` re-runs the load after a change
  useEffect(() => {
    let cancelled = false
    api.affiliates.get({ id: params.id ?? '' }).then((r) => {
      if (cancelled) return
      setData(r)
      setNote(r.affiliate.note)
    })
    api.store.origin().then((o) => {
      if (!cancelled) setOrigin(o)
    })
    return () => {
      cancelled = true
    }
  }, [params.id, reload])

  // Event handlers
  const handleChanged = () => setReload((n) => n + 1)
  const handleSaveNote = async () => {
    try {
      await api.affiliates.saveNote({ id: params.id ?? '', note })
      toast.success(copy.detail.noteSaved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    }
  }

  // Early returns
  if (!data) return null

  // Render logic
  const a = data.affiliate
  const t = data.totals
  const d = copy.detail
  const link = `${origin.replace(/\/+$/, '')}/?ref=${a.code}`
  const facts = [
    { label: d.link, value: link },
    { label: d.coupon, value: a.couponCode ?? d.noCoupon },
    { label: d.social, value: a.social || '—' },
    { label: d.payout, value: a.payoutHint ?? d.payoutNone },
    { label: d.panLabel, value: a.hasPan ? d.pan : d.noPan },
    { label: d.gstLabel, value: a.gstRegistered ? d.gstYes : d.gstNo },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={a.name || a.code}
        subtitle={a.email ?? undefined}
        back={{ label: d.back, href: routes.apps.page('affiliates', 'affiliates') }}
        badges={
          <StatusChip tone={statusTone(a.status)}>{copy.status[a.status] ?? a.status}</StatusChip>
        }
        actions={
          <AffiliateRowActions
            id={a.id}
            status={a.status}
            onChanged={handleChanged}
            showOpen={false}
          />
        }
      />
      <StatStrip
        tiles={[
          { id: 'clicks', label: d.tiles.clicks, value: f.number(t.clicks) },
          { id: 'orders', label: d.tiles.orders, value: f.number(t.orders) },
          { id: 'sales', label: d.tiles.sales, value: f.money(t.salesPaise) },
          { id: 'pending', label: d.tiles.pending, value: f.money(t.pendingPaise) },
          { id: 'owed', label: d.tiles.owed, value: f.money(t.approvedPaise) },
          { id: 'paid', label: d.tiles.paid, value: f.money(t.paidPaise) },
        ]}
      />
      {a.reviewReasons.length > 0 ? (
        <ReviewCard affiliateId={a.id} reasons={a.reviewReasons} onChanged={handleChanged} />
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <dl className="flex flex-col gap-3 rounded-xl surface-card px-5 py-4">
          {facts.map((x) => (
            <div key={x.label} className="flex flex-col gap-0.5">
              <dt className="text-caption text-muted-foreground">{x.label}</dt>
              <dd className="break-all text-body">{x.value}</dd>
            </div>
          ))}
          {a.message ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-caption text-muted-foreground">{d.applied}</dt>
              <dd className="whitespace-pre-wrap text-body">{a.message}</dd>
            </div>
          ) : null}
        </dl>
        <div className="flex flex-col gap-3 rounded-xl surface-card px-5 py-4">
          <label htmlFor="aff-note" className="text-caption text-muted-foreground">
            {d.note}
          </label>
          <Textarea id="aff-note" value={note} onChange={(e) => setNote(e.target.value)} rows={5} />
          <div>
            <Button variant="outline" onClick={handleSaveNote}>
              {d.saveNote}
            </Button>
          </div>
        </div>
      </div>
      {a.status === 'approved' ? (
        <CodesCard
          affiliateId={a.id}
          code={a.code}
          couponCode={a.couponCode}
          request={a.codeRequest}
          history={data.codes}
          onChanged={handleChanged}
        />
      ) : null}
      <AffiliateProgramCard
        key={`${a.programId}-${JSON.stringify(a.rateOverride)}`}
        affiliateId={a.id}
        programId={data.program?.id ?? a.programId}
        programs={data.programs}
        programRule={data.program?.rules.commission ?? null}
        rateOverride={a.rateOverride}
        onChanged={handleChanged}
      />
      <h2 className="text-body font-semibold text-ink-strong">{d.commissions}</h2>
      <ResourceTable
        resourceName={copy.commissions.resource}
        columns={commissionColumns(copy, f, handleChanged, { withAffiliate: false })}
        items={data.ledger}
        getId={(r) => r.id}
        href={(r) => routes.orders.detail(r.orderId)}
        selectable={false}
        query=""
        onQueryChange={() => {}}
        page={1}
        perPage={Math.max(1, data.ledger.length)}
        total={data.ledger.length}
        onPageChange={() => {}}
        empty={{ heading: copy.commissions.empty }}
      />
    </div>
  )
}
