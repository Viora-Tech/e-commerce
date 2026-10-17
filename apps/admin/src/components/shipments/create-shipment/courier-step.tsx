'use client'

import { PackageOpen, Plus, RefreshCw } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Link from 'next/link'
import { useState } from 'react'
import TrackingFields, { type TrackingDraft } from '@/components/orders/tracking-fields'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import { courierGroup, groupCounts } from './courier-groups'
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
  /** The package has no usable weight yet, so the couriers have not been asked. */
  needsPackage?: boolean
  /** Asking the couriers failed; show why with a retry rather than a spinner. */
  failed?: boolean
  /** Inside a card that already shows the heading and help (the full-page flow). */
  inCard?: boolean
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
  needsPackage = false,
  failed = false,
  inCard = false,
}: CourierStepProps) {
  // Hooks
  const copy = useCopy(createShipmentContent)
  const fmt = useFormat()
  const [filter, setFilter] = useState<string | null>(null)

  // Render logic
  const manual = pick === MANUAL
  const anyProblem = quote?.options.some((o) => o.problem === 'unreachable') ?? false
  const groups = quote ? groupCounts(quote.options) : []
  const shown =
    quote?.options.filter((o) => filter === null || courierGroup(o.providerLabel) === filter) ?? []
  const kg = quote ? fmt.number(Math.round(quote.chargedWeightGrams / 10) / 100) : null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        {inCard ? null : (
          <div className="flex flex-col gap-0.5">
            <p className="text-body font-medium text-ink-strong">{copy.courier.heading}</p>
            <p className="text-caption text-muted-foreground">
              {hasCouriers ? copy.courier.help : copy.courier.noCourier}
              {kg && hasCouriers ? ` ${copy.package.charged(kg)}` : ''}
            </p>
          </div>
        )}
        {anyProblem && !inCard ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw aria-hidden />
            {copy.courier.retry}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {hasCouriers && !quote ? (
          needsPackage ? (
            <p className="py-6 text-body text-muted-foreground">{copy.courier.needsWeight}</p>
          ) : failed ? (
            <p className="flex items-center gap-3 py-6 text-body text-muted-foreground">
              {copy.courier.quoteFailed}
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RefreshCw aria-hidden />
                {copy.courier.retry}
              </Button>
            </p>
          ) : (
            <p className="flex items-center gap-2 py-6 text-body text-muted-foreground">
              <Spinner />
              {copy.courier.checking}
            </p>
          )
        ) : null}
        {groups.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {[{ group: null, count: quote?.options.length ?? 0 }, ...groups].map((g) => (
              <button
                key={g.group ?? 'all'}
                type="button"
                aria-pressed={filter === g.group}
                onClick={() => setFilter(g.group)}
                className={cn(
                  'motion-press flex h-8 items-center gap-1.5 rounded-full border px-3 text-body',
                  filter === g.group
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {g.group ?? copy.courier.filterAll}
                <span className="tabular-nums opacity-70">{g.count}</span>
              </button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              nativeButton={false}
              render={<Link href={routes.settings.shipping()} />}
            >
              <Plus aria-hidden />
              {copy.courier.manage}
            </Button>
          </div>
        ) : null}
        {shown.map((row) => (
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
