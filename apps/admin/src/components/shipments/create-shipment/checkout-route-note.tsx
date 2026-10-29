'use client'

import { TriangleAlert, Truck } from '@commerce/ui/icons'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { ParcelQuote } from './flow-state'

type CheckoutRouteNoteProps = {
  quote: ParcelQuote
}

/**
 * Delivery options app: the route the shopper paid for, above the rate table. Its row is
 * picked and marked "Chosen at checkout"; when it cannot be booked, the reason and the next
 * route that still fits (product rules, insurance, COD, speed), so a swap is never silent.
 */
export default function CheckoutRouteNote({ quote }: CheckoutRouteNoteProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.courier)
  const fmt = useFormat()

  // Early returns
  const c = quote.checkout
  if (!c) return null

  // Render logic
  const route = `${c.serviceLabel} (${c.providerId})`
  const fallback = quote.options.find((o) => o.optionKey === c.fallbackKey)

  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-start gap-2 rounded-lg border border-info/30 bg-info-soft px-3 py-2.5 text-body text-info">
        <Truck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>
          {copy.checkout.paid(c.optionName, `${c.carrier} · ${route}`, fmt.money(c.chargedPaise))}
          {c.insured ? ` ${copy.checkout.insured}.` : ''}
        </span>
      </p>
      {c.problem ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-soft px-3 py-2.5 text-body text-ink-strong"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger" />
          <span>
            {copy.checkout.failed(
              route,
              c.problem === 'not_offered' ? copy.checkout.notOffered : c.problem,
            )}{' '}
            {fallback ? copy.checkout.fallback(fallback.providerLabel) : copy.checkout.noFallback}
          </span>
        </p>
      ) : null}
    </div>
  )
}
