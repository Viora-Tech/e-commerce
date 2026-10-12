'use client'

import { PackageOpen, Plus, RefreshCw } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Link from 'next/link'
import TrackingFields, { type TrackingDraft } from '@/components/orders/tracking-fields'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import CourierOption from './courier-option'
import { MANUAL, type ParcelQuote } from './flow-state'

type CourierStepProps = {
  /** Null while the couriers are being asked. */
  quote: ParcelQuote | null
  hasCouriers: boolean
  pick: string
  onPick: (providerId: string) => void
  tracking: TrackingDraft
  onTrackingChange: (next: TrackingDraft) => void
  onRetry: () => void
}

/** Step 2: every connected courier with its live rate, delivery date and COD, plus "Ship it
 *  yourself". A courier that can't take the parcel says why without blocking the rest. */
export default function CourierStep({
  quote,
  hasCouriers,
  pick,
  onPick,
  tracking,
  onTrackingChange,
  onRetry,
}: CourierStepProps) {
  // Hooks
  const copy = useCopy(createShipmentContent)
  const fmt = useFormat()

  // Render logic
  const manual = pick === MANUAL
  const anyProblem = quote?.options.some((o) => o.problem === 'unreachable') ?? false
  const kg = quote ? fmt.number(Math.round(quote.chargedWeightGrams / 10) / 100) : null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-body font-medium text-ink-strong">{copy.courier.heading}</p>
          <p className="text-caption text-muted-foreground">
            {hasCouriers ? copy.courier.help : copy.courier.noCourier}
            {kg && hasCouriers ? ` ${copy.package.charged(kg)}` : ''}
          </p>
        </div>
        {anyProblem ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw aria-hidden />
            {copy.courier.retry}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {hasCouriers && !quote ? (
          <p className="flex items-center gap-2 py-6 text-body text-muted-foreground">
            <Spinner />
            {copy.courier.checking}
          </p>
        ) : null}
        {quote?.options.map((row) => (
          <CourierOption
            key={row.providerId}
            row={row}
            selected={pick === row.providerId}
            onSelect={() => onPick(row.providerId)}
          />
        ))}

        <div
          className={cn(
            'flex flex-col gap-3 rounded-lg border p-3',
            manual ? 'border-primary bg-primary-soft ring-1 ring-primary' : 'border-hairline',
          )}
        >
          <button
            type="button"
            aria-pressed={manual}
            onClick={() => onPick(MANUAL)}
            className="motion-press flex items-start gap-3 text-left"
          >
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-4">
              <PackageOpen aria-hidden />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-medium text-ink-strong">{copy.courier.manual}</span>
              <span className="text-caption text-muted-foreground">{copy.courier.manualHelp}</span>
            </span>
          </button>
          {manual ? <TrackingFields value={tracking} onChange={onTrackingChange} /> : null}
        </div>
      </div>

      {hasCouriers ? null : (
        <Button
          variant="outline"
          className="w-fit"
          nativeButton={false}
          render={<Link href={routes.apps.list()} />}
        >
          <Plus aria-hidden />
          {copy.courier.connect}
        </Button>
      )}
    </div>
  )
}
