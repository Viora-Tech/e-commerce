'use client'

import { cn } from '@commerce/ui/lib/utils'
import CourierMark from '@/components/shipments/create-shipment/courier-mark'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { TryPinResult } from './format'

type CheckoutPreviewListProps = {
  result: TryPinResult | null
  loading: boolean
  failed: boolean
  /** `logos`: the courier list look (logo, courier, +₹ extra); `cards`: option cards. */
  look?: 'cards' | 'logos'
}

type Option = TryPinResult['options'][number]
type Choice = Option['choices'][number]

const SHORT_DATE = { weekday: 'short', day: 'numeric', month: 'short' } as const

/** One card as the shopper sees it at checkout. */
type Card = {
  key: string
  title: string
  /** The courier, when the card names it. */
  logo: string | null
  lines: string[]
  price: string
}

/**
 * The delivery cards a shopper sees at checkout (Figma 929:11373 "At checkout now", 938:12101
 * "Checkout preview"), the first one picked as checkout picks it.
 */
export default function CheckoutPreviewList({
  result,
  loading,
  failed,
  look = 'cards',
}: CheckoutPreviewListProps) {
  // Hooks
  const pages = useCopy(deliveryPagesContent)
  const fmt = useFormat()

  // Helpers
  const by = (latest: string | null, estimated: boolean) =>
    estimated || !latest ? pages.preview.usually : pages.preview.by(fmt.pattern(latest, SHORT_DATE))
  const speedWord = (speed: string) =>
    speed === 'express' ? pages.preview.air : pages.preview.surface
  const money = (paise: number) => (paise === 0 ? pages.preview.free : fmt.money(paise))
  const listCards = (o: Option): Card[] =>
    o.choices.map((c: Choice, i) => ({
      key: c.route.key,
      title: c.route.showCarrier ? c.route.carrier : o.name,
      logo: c.route.showCarrier ? c.route.carrier : null,
      lines: [`${speedWord(c.route.speed)} · ${by(c.latest, c.etaEstimated)}`],
      price:
        i === 0 ? money(c.pricePaise) : pages.preview.extra(fmt.money(c.pricePaise - o.pricePaise)),
    }))
  const optionCard = (o: Option): Card => {
    const route = o.pick?.route
    const via = route ? (route.showCarrier ? `${route.carrier} · ` : '') : ''
    const when =
      o.source === 'backup'
        ? pages.preview.backup
        : `${via}${speedWord(o.speed)} · ${by(o.latest, o.etaEstimated)}`
    return {
      key: o.optionId,
      title: o.name,
      logo: look === 'logos' && route?.showCarrier ? route.carrier : null,
      lines: [when, o.codAllowed ? pages.preview.cod : pages.preview.prepaid],
      price: money(o.pricePaise),
    }
  }

  // Early returns
  const p = pages.preview
  if (!result) {
    return (
      <p className="text-body text-muted-foreground">
        {loading ? p.asking : failed ? p.failed : ''}
      </p>
    )
  }

  // Render logic
  const cards = result.options.flatMap((o) =>
    o.layout === 'list' && o.choices.length > 0 ? listCards(o) : [optionCard(o)],
  )
  const empty = result.status === 'unserviceable' ? p.unserviceable : p.none

  return cards.length === 0 ? (
    <p className="text-body text-muted-foreground">{empty}</p>
  ) : (
    <ul className={cn('flex flex-col gap-2.5 transition-opacity', loading && 'opacity-60')}>
      {cards.map((card, i) => (
        <li
          key={card.key}
          className={cn(
            'flex items-center gap-3 rounded-lg border px-4 py-3',
            i === 0 ? 'border-ink-strong ring-1 ring-ink-strong' : 'border-hairline',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'flex size-4 shrink-0 items-center justify-center rounded-full border',
              i === 0 ? 'border-ink-strong bg-ink-strong' : 'border-muted-foreground/50',
            )}
          />
          {card.logo ? <CourierMark label={card.logo} className="h-6 w-10" /> : null}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-body font-medium text-ink-strong">{card.title}</span>
            {card.lines.map((line) => (
              <span key={line} className="truncate text-caption text-muted-foreground">
                {line}
              </span>
            ))}
          </span>
          <span className="shrink-0 text-body font-medium text-ink-strong tabular-nums">
            {card.price}
          </span>
        </li>
      ))}
    </ul>
  )
}
