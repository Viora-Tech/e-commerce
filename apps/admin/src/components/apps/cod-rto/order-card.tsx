'use client'

import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { codRtoContent } from '@/data/cod-rto'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import RiskChip from './risk-chip'

type OrderCardProps = { orderId: string }

type Data = Awaited<ReturnType<typeof api.codRto.forOrder>>

const VERIFICATION_TONE = {
  pending: 'info',
  confirmed: 'success',
  cancelled: 'neutral',
  unconfirmed: 'attention',
} as const

/** The COD & RTO app's card on the order page: the risk score and why, and the COD answer. */
export default function OrderCard({ orderId }: OrderCardProps) {
  // Hooks
  const copy = useCopy(codRtoContent)
  const format = useFormat()
  const [data, setData] = useState<Data | null>(null)
  const [busy, setBusy] = useState<'score' | 'confirm' | null>(null)

  useEffect(() => {
    api.codRto.forOrder({ orderId }).then(setData)
  }, [orderId])

  // Helpers
  const run = async (key: 'score' | 'confirm', fn: () => Promise<unknown>, done: string) => {
    setBusy(key)
    try {
      await fn()
      setData(await api.codRto.forOrder({ orderId }))
      toast.success(done)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(null)
    }
  }

  // Event handlers
  const handleRescore = () => run('score', () => api.codRto.rescore({ orderId }), copy.card.scored)
  const handleConfirm = () =>
    run('confirm', () => api.codRto.markConfirmed({ orderId }), copy.card.marked)

  // Early returns
  if (!data) return null

  // Render logic
  const risk = data.risk
  const verification = data.verification
  const canConfirm =
    data.paymentMethod === 'cod' &&
    data.status === 'open' &&
    (verification === 'pending' || verification === 'unconfirmed')

  return (
    <DataCard
      title={copy.card.title}
      action={
        <Link
          href={routes.apps.page('cod-rto', 'settings')}
          className="text-caption text-muted-foreground hover:text-foreground"
        >
          {copy.card.settings}
        </Link>
      }
    >
      <div className="flex flex-col gap-4">
        {risk ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-body text-muted-foreground">{copy.card.score}</span>
              <RiskChip
                level={risk.level}
                label={copy.levels[risk.level] ?? risk.level}
                score={risk.score}
              />
            </div>
            {risk.factors.length === 0 ? (
              <p className="text-caption text-muted-foreground">{copy.card.noFactors}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {risk.factors.map((f) => (
                  <li key={f.code} className="flex items-start justify-between gap-3 text-caption">
                    <span>{copy.factors[f.code] ?? f.code}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {f.points > 0 ? `+${f.points}` : f.points}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-body text-muted-foreground">
            {data.hasAddress ? copy.card.notScored : copy.card.noAddress}
          </p>
        )}

        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <span className="text-body font-medium">{copy.card.codTitle}</span>
          {verification ? (
            <div className="flex flex-col gap-1">
              <StatusChip tone={VERIFICATION_TONE[verification]} className="self-start">
                {copy.verification[verification] ?? verification}
              </StatusChip>
              {data.requestedAt ? (
                <span className="text-caption text-muted-foreground">
                  {copy.card.askedAt(format.dateTime(data.requestedAt))}
                </span>
              ) : null}
              {data.verifiedAt && verification !== 'pending' ? (
                <span className="text-caption text-muted-foreground">
                  {copy.card.answeredAt(format.dateTime(data.verifiedAt))}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-caption text-muted-foreground">{copy.card.codNone}</p>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {data.hasAddress ? (
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={handleRescore}>
              {copy.card.scoreAgain}
            </Button>
          ) : null}
          {canConfirm ? (
            <Button size="sm" disabled={busy !== null} onClick={handleConfirm}>
              {copy.card.markConfirmed}
            </Button>
          ) : null}
        </div>
      </div>
    </DataCard>
  )
}
