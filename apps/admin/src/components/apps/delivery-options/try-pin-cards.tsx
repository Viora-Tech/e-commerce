'use client'

import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { TryPinResult } from './format'

type TryPinCardsProps = {
  result: TryPinResult
}

const SHORT_DATE = { weekday: 'short', day: 'numeric', month: 'short' } as const

/** Try a PIN: the option cards as the shopper would see them at checkout. */
export default function TryPinCards({ result }: TryPinCardsProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const fmt = useFormat()

  // Helpers
  const price = (p: number) => (p === 0 ? copy.tryPin.free : fmt.money(p))
  const date = (o: { earliest: string | null; latest: string | null; etaEstimated: boolean }) =>
    o.etaEstimated || !o.latest
      ? copy.tryPin.usually
      : o.earliest && o.earliest !== o.latest
        ? `${fmt.pattern(o.earliest, SHORT_DATE)} – ${fmt.pattern(o.latest, SHORT_DATE)}`
        : fmt.pattern(o.latest, SHORT_DATE)

  // Render logic
  const t = copy.tryPin

  return (
    <div className="flex flex-col gap-2">
      <p className="text-body font-medium text-ink-strong">{t.cardsTitle}</p>
      {result.status === 'unserviceable' ? (
        <p className="text-body text-danger">{t.unserviceable}</p>
      ) : result.options.length === 0 ? (
        <p className="text-body text-muted-foreground">{t.noCards}</p>
      ) : (
        result.options.map((o) => (
          <div
            key={o.optionId}
            className="flex flex-col gap-1 rounded-lg border border-hairline p-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium text-ink-strong">{o.title}</span>
              <span className="text-body tabular-nums text-ink-strong">
                {o.pricePaise === 0 && o.listPricePaise > 0 ? (
                  <s className="mr-1.5 text-caption text-muted-foreground">
                    {fmt.money(o.listPricePaise)}
                  </s>
                ) : null}
                {price(o.pricePaise)}
              </span>
            </div>
            <span className="text-caption text-muted-foreground">
              {o.source === 'backup' ? t.backup : date(o)}
            </span>
            {o.choices.length > 1 ? (
              <ul className="ml-4 flex flex-col gap-0.5 text-caption">
                {o.choices.map((c) => (
                  <li key={c.route.key} className="flex justify-between gap-3">
                    <span>
                      {c.route.carrier} · {c.route.serviceLabel}
                    </span>
                    <span className="tabular-nums">
                      {date(c)} · {fmt.money(c.pricePaise)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <span className="text-caption text-muted-foreground">
              {o.codAllowed
                ? o.cod && o.cod.route.key !== o.pick?.route.key
                  ? t.codVia(o.cod.route.carrier, fmt.money(o.cod.pricePaise))
                  : null
                : t.prepaidOnly}
              {o.insurance.on
                ? ` ${t.insured(o.insurance.pricePaise ? fmt.money(o.insurance.pricePaise) : null)}`
                : null}
            </span>
          </div>
        ))
      )}
    </div>
  )
}
