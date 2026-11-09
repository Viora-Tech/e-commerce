'use client'

import { orderRef } from '@commerce/core/draft-number'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import StatusChip from '@/components/layout/status-chip'
import { checkoutDraftContent, draftsContent } from '@/data/drafts'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Draft = NonNullable<Awaited<ReturnType<typeof api.orders.getDraft>>>

type CheckoutDraftViewProps = {
  /** A shopper's unpaid checkout (`draftSource = 'checkout'`), as `orders.getDraft` returns it. */
  draft: Draft
}

type Asking = 'paid' | 'convert' | 'delete' | null

/** The latest attempt still waiting on a transfer: "Mark as paid" captures it. */
const openTransfer = (d: Draft) =>
  d.paymentMethod === 'manual' &&
  d.attempts.some((a) => a.provider === 'manual' && ['created', 'pending'].includes(a.status))

/**
 * A shopper's unpaid checkout (#D57): what they checked out, how they tried to pay and when they
 * last came back. It is kept as the shopper checked it out (no editing); it becomes an order when
 * the payment arrives, when the merchant marks a transfer paid, or by "Convert to order (unpaid)".
 */
export default function CheckoutDraftView({ draft: d }: CheckoutDraftViewProps) {
  // Hooks
  const copy = useCopy(checkoutDraftContent)
  const listCopy = useCopy(draftsContent)
  const fmt = useFormat()
  const router = useRouter()
  const [asking, setAsking] = useState<Asking>(null)

  // Event handlers
  const handleCopyLink = async () => {
    if (!d.payLink) return
    await navigator.clipboard.writeText(d.payLink)
    toast.success(copy.payLinkCopied)
  }

  const handleMarkPaid = async () => {
    try {
      const r = await api.orders.collectPayment({
        orderId: d.id,
        amountPaise: d.totalPaise,
        method: 'manual',
        paidWith: 'upi',
      })
      if (r?.number && r.number > 0) toast.success(copy.converted(r.number))
      router.push(routes.orders.detail(d.id))
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failedAction)
      throw err
    }
  }

  const handleConvert = async () => {
    try {
      const r = await api.orders.convertDraft({ id: d.id })
      if (r.number > 0) toast.success(copy.converted(r.number))
      router.push(routes.orders.detail(d.id))
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failedAction)
      throw err
    }
  }

  const handleDelete = async () => {
    try {
      await api.orders.deleteDraft({ id: d.id })
      toast.success(listCopy.deleted(1))
      router.push(routes.orders.drafts())
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failedAction)
      throw err
    }
  }

  // Render logic
  const ref = orderRef(d)
  const refundNeeded = d.attempts.some((a) => a.refundNeeded)
  const method = copy.methods[d.paymentMethod === 'manual' ? 'manual' : 'online']
  const held = d.draftReserved?.length && d.reservedUntil ? d.reservedUntil : null
  const canMarkPaid = openTransfer(d) && !d.draftExpiredAt

  return (
    <ProoflyDetailPage
      header={
        <PageHeader
          title={`#${ref}`}
          back={{ label: listCopy.heading, href: routes.orders.drafts() }}
          subtitle={copy.intro}
          badges={
            <StatusChip tone={refundNeeded ? 'danger' : 'attention'}>
              {refundNeeded ? listCopy.status.refundNeeded : copy.badge}
            </StatusChip>
          }
          actions={
            <>
              {d.payLink && !d.draftExpiredAt ? (
                <Button variant="outline" onClick={handleCopyLink}>
                  {copy.payLink}
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => setAsking('convert')}>
                {copy.convert}
              </Button>
              {canMarkPaid ? (
                <Button onClick={() => setAsking('paid')}>{copy.markPaid}</Button>
              ) : null}
              <Button variant="ghost" onClick={() => setAsking('delete')}>
                {copy.deleteDraft}
              </Button>
            </>
          }
        />
      }
      main={
        <>
          {refundNeeded || d.draftExpiredAt ? (
            <DataCard title={copy.badge}>
              <p className="text-body text-ink-strong">
                {refundNeeded ? copy.refundNeeded : copy.expired}
              </p>
            </DataCard>
          ) : null}
          <DataCard title={copy.items} count={d.lines.length}>
            <ul className="flex flex-col gap-2">
              {d.lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-4 text-body">
                  <span className="min-w-0 truncate">
                    {l.quantity} × {l.title}
                    {l.variantTitle && l.variantTitle !== 'Default' ? ` / ${l.variantTitle}` : ''}
                  </span>
                  <span className="tabular-nums">{fmt.money(l.unitPricePaise * l.quantity)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-4 border-t pt-2 font-medium">
                <span>{copy.total}</span>
                <span className="tabular-nums">{fmt.money(d.totalPaise)}</span>
              </li>
            </ul>
          </DataCard>
          <DataCard title={copy.attempts} count={d.attempts.length}>
            {d.attempts.length === 0 ? (
              <p className="text-body text-muted-foreground">{copy.noAttempts}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {d.attempts.map((a) => (
                  <li key={a.id} className="flex flex-wrap justify-between gap-x-4 text-body">
                    <span>
                      {copy.attempt(a.attempt)} · {copy.attemptStatus[a.status] ?? a.status}
                      {a.error ? ` · ${a.error}` : ''}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {fmt.when(a.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DataCard>
          {d.timeline.length > 0 ? (
            <DataCard title={copy.timeline}>
              <ul className="flex flex-col gap-2">
                {d.timeline.map((n) => (
                  <li key={n.id} className="flex flex-wrap justify-between gap-x-4 text-body">
                    <span>{n.body}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {fmt.when(n.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </DataCard>
          ) : null}
        </>
      }
      side={
        <DataCard title={copy.summary}>
          <dl className="flex flex-col gap-3 text-body">
            <div>
              <dt className="text-muted-foreground">{copy.contact}</dt>
              <dd>{[d.customer?.name, d.email, d.phone].filter(Boolean).join(' · ')}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{copy.method}</dt>
              <dd>{method}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{copy.lastActivity}</dt>
              <dd className="tabular-nums">{fmt.when(d.lastActivityAt ?? d.placedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{held ? copy.held : copy.items}</dt>
              <dd className="tabular-nums">{held ? fmt.when(held) : copy.notHeld}</dd>
            </div>
          </dl>
        </DataCard>
      }
    >
      <ConfirmDialog
        open={asking === 'paid'}
        onOpenChange={(open) => !open && setAsking(null)}
        title={copy.markPaidTitle}
        body={copy.markPaidBody(fmt.money(d.totalPaise))}
        confirmLabel={copy.markPaid}
        cancelLabel={copy.cancel}
        tone="default"
        onConfirm={handleMarkPaid}
      />
      <ConfirmDialog
        open={asking === 'convert'}
        onOpenChange={(open) => !open && setAsking(null)}
        title={copy.convertTitle}
        body={copy.convertBody}
        confirmLabel={copy.convert}
        cancelLabel={copy.cancel}
        tone="default"
        onConfirm={handleConvert}
      />
      <ConfirmDialog
        open={asking === 'delete'}
        onOpenChange={(open) => !open && setAsking(null)}
        title={listCopy.deleteTitle(1)}
        body={listCopy.deleteBody(1)}
        confirmLabel={listCopy.deleteDraft}
        cancelLabel={copy.cancel}
        onConfirm={handleDelete}
      />
    </ProoflyDetailPage>
  )
}
