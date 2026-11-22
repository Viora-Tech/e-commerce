'use client'

import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCard from '@/components/layout/data-card'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import EmptyState from '@/components/layout/empty-state'
import StatusChip from '@/components/layout/status-chip'
import { appsContent } from '@/data/apps'
import { codRtoContent } from '@/data/cod-rto'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
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
  const apps = useCopy(appsContent)
  const { data, failed, retry, setData } = useLoad<Data>(
    () => api.codRto.forOrder({ orderId }),
    [orderId],
  )
  const [busy, setBusy] = useState<'score' | 'confirm' | null>(null)

  // Helpers
  const run = async (key: 'score' | 'confirm', fn: () => Promise<unknown>, done: string) => {
    setBusy(key)
    try {
      await fn()
      setData(await api.codRto.forOrder({ orderId }))
      toast.success(done)
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    } finally {
      setBusy(null)
    }
  }

  // Event handlers
  const handleRescore = () => run('score', () => api.codRto.rescore({ orderId }), copy.card.scored)
  const handleConfirm = () =>
    run('confirm', () => api.codRto.markConfirmed({ orderId }), copy.card.marked)

  // Early returns
  if (!data && failed) {
    return (
      <DataCard title={copy.card.title}>
        <LoadFailedState heading={apps.couldNotLoad.details} failed={failed} onRetry={retry} />
      </DataCard>
    )
  }
  if (!data) return <DataCardSkeleton fields={0} lines={3} />

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
              <EmptyState variant="inline" body={copy.card.noFactors} />
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
            <Button
              loading={busy === 'confirm'}
              size="sm"
              disabled={busy !== null}
              onClick={handleConfirm}
            >
              {copy.card.markConfirmed}
            </Button>
          ) : null}
        </div>
      </div>
    </DataCard>
  )
}
