'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type CodesCardProps = {
  affiliateId: string
  code: string
  couponCode: string | null
  request: { code: string; status: 'pending' | 'approved' | 'declined' } | null
  history: { kind: 'link' | 'coupon'; code: string; status: 'active' | 'retired' }[]
  onChanged: () => void
}

/** An affiliate's codes: the current ones, replacing a leaked coupon, their code request, earlier codes. */
export default function CodesCard({
  affiliateId,
  code,
  couponCode,
  request,
  history,
  onChanged,
}: CodesCardProps) {
  // Hooks
  const { detail, failed } = useCopy(affiliatesContent)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const run = async (
    fn: () => Promise<{ couponCode: string | null }>,
    done: (r: { couponCode: string | null }) => string,
  ) => {
    setBusy(true)
    try {
      const r = await fn()
      toast.success(done(r))
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failed)
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }
  const handleRotate = () =>
    run(
      () => api.affiliates.rotateCoupon({ id: affiliateId }),
      (r) => c.rotated(r.couponCode ?? ''),
    )
  const handleDecide = (decision: 'approve' | 'decline') =>
    run(
      () => api.affiliates.decideCode({ id: affiliateId, decision }),
      () => (decision === 'approve' ? c.approved : c.declined),
    )

  // Render logic
  const c = detail.codes
  const retired = history.filter((h) => h.status === 'retired')

  return (
    <div className="flex flex-col gap-4 rounded-xl surface-card px-5 py-4">
      <h2 className="text-body font-semibold text-ink-strong">{c.title}</h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-caption text-muted-foreground">{c.link}</dt>
          <dd className="font-mono text-body">{code}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-caption text-muted-foreground">{c.coupon}</dt>
          <dd className="font-mono text-body">{couponCode ?? '—'}</dd>
        </div>
      </dl>
      {request?.status === 'pending' ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
          <span className="text-body">{c.request(request.code)}</span>
          <span className="flex gap-2">
            <Button size="sm" onClick={() => handleDecide('approve')} disabled={busy}>
              {c.approve}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDecide('decline')}
              disabled={busy}
            >
              {c.decline}
            </Button>
          </span>
        </div>
      ) : null}
      {couponCode ? (
        <div className="flex flex-col gap-1">
          <div>
            <Button variant="outline" onClick={() => setConfirming(true)} disabled={busy}>
              {c.rotate}
            </Button>
          </div>
          <p className="text-caption text-muted-foreground">{c.rotateHelp}</p>
        </div>
      ) : null}
      {retired.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-caption text-muted-foreground">{c.history}</p>
          <ul className="flex flex-wrap gap-2">
            {retired.map((h) => (
              <li
                key={`${h.kind}-${h.code}`}
                className="rounded-md bg-muted px-2 py-0.5 font-mono text-caption text-muted-foreground"
              >
                {c.kinds[h.kind]}: {h.code}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={c.rotateConfirm}
        body={c.rotateHelp}
        confirmLabel={c.rotate}
        busy={busy}
        onConfirm={handleRotate}
      />
    </div>
  )
}
