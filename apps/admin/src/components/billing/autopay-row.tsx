'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { billingContent } from '@/data/billing'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

export type AutopayState = Awaited<ReturnType<typeof api.billing.autopay>>

type AutopayRowProps = { autopay: AutopayState; billingReady: boolean }

/** Plan & billing → Payment method: UPI AutoPay on, waiting for the mandate, failed, or off. */
export default function AutopayRow({ autopay, billingReady }: AutopayRowProps) {
  // Hooks
  const copy = useCopy(billingContent)
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleStart = async () => {
    setBusy(true)
    try {
      const r = await api.billing.startAutopay()
      window.location.assign(r.approveUrl)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.payment.autopayFailed)
      setBusy(false)
    }
  }

  const handleStop = async () => {
    setBusy(true)
    try {
      await api.billing.cancelAutopay()
      toast.success(copy.payment.autopayStopped)
      router.refresh()
    } catch {
      toast.error(copy.payment.autopayFailed)
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  if (!billingReady)
    return <p className="mt-3 text-caption text-muted-foreground">{copy.payment.notReady}</p>
  if (!autopay.available)
    return <p className="mt-3 text-caption text-muted-foreground">{copy.payment.autopay}</p>

  // Render logic
  const status = autopay.mandate?.status ?? null
  const line =
    status === 'active'
      ? copy.payment.autopayOn
      : status === 'created'
        ? copy.payment.autopayPending
        : status === 'halted'
          ? copy.payment.autopayHalted
          : copy.payment.autopayOff
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-caption text-muted-foreground">{line}</p>
      <div className="flex gap-2">
        {status === 'created' && autopay.mandate?.approveUrl ? (
          <Button
            size="sm"
            nativeButton={false}
            render={
              <a href={autopay.mandate.approveUrl} target="_blank" rel="noopener noreferrer" />
            }
          >
            {copy.payment.autopayApprove}
          </Button>
        ) : null}
        {status === 'active' || status === 'created' ? (
          <Button size="sm" variant="outline" loading={busy} onClick={handleStop}>
            {copy.payment.autopayStop}
          </Button>
        ) : (
          <Button size="sm" loading={busy} onClick={handleStart}>
            {copy.payment.autopayStart}
          </Button>
        )}
      </div>
    </div>
  )
}
