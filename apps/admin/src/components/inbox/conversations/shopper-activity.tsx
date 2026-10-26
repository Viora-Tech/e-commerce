'use client'

import { Eye, MapPinLineIcon } from '@commerce/ui/icons'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import { toneFor } from '@/components/status/tone'
import { inboxConversationsContent } from '@/data/inbox-conversations'
import { statusEntry } from '@/data/status'
import { useCopy, useFormat, useLocale } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { localizeStatusLabel } from '@/lib/status-labels'

type Panel = Awaited<ReturnType<typeof api.inbox.panel>>

type ShopperActivityProps = {
  panel: Panel
}

/**
 * The customer panel's "Activity": the product page the shopper wrote from, the pages they
 * chatted from, where they are (their saved address) and their last order's state.
 */
export default function ShopperActivity({ panel }: ShopperActivityProps) {
  // Hooks
  const copy = useCopy(inboxConversationsContent)
  const fmt = useFormat()
  const locale = useLocale()

  // Helpers
  const chip = (kind: 'order' | 'payment' | 'fulfilment', value: string) => {
    const entry = statusEntry(kind, value)
    return (
      <StatusChip tone={toneFor(entry.tone)}>{localizeStatusLabel(entry.label, locale)}</StatusChip>
    )
  }

  // Early returns
  const last = panel.orders[0]
  if (!panel.viewing && panel.pages.length === 0 && !panel.location && !last) return null

  // Render logic
  const p = copy.panel
  const v = panel.viewing

  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-eyebrow text-muted-foreground">
        <Eye className="size-3.5" aria-hidden="true" />
        {p.activity}
      </h3>
      {v ? (
        <div className="flex items-center gap-3">
          {v.imageUrl ? (
            // biome-ignore lint/performance/noImgElement: product images live on the store's storage host
            <img
              src={v.imageUrl}
              alt=""
              className="size-10 shrink-0 rounded-md border border-hairline object-cover"
            />
          ) : null}
          <div className="flex min-w-0 flex-col">
            <span className="text-caption text-muted-foreground">{p.viewing}</span>
            <Link href={routes.products.detail(v.id)} className="truncate text-body underline">
              {v.title}
            </Link>
            <span className="text-caption text-muted-foreground tabular-nums">
              {v.minPricePaise !== null ? fmt.money(v.minPricePaise) : null}
              {v.available ? null : ` · ${p.soldOut}`}
            </span>
          </div>
        </div>
      ) : null}
      {panel.pages.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-caption text-muted-foreground">{p.pages}</span>
          <ul className="flex flex-col gap-0.5">
            {panel.pages.map((page) => (
              <li key={page} className="truncate font-mono text-caption" title={page}>
                {page}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {panel.location ? (
        <p className="flex items-center gap-1.5 text-body">
          <MapPinLineIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">{p.location}: </span>
          {panel.location.city}, {panel.location.stateCode}
          {panel.location.pincode ? ` ${panel.location.pincode}` : ''}
        </p>
      ) : null}
      {last ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-muted-foreground">{p.lastOrder}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={routes.orders.detail(last.id)} className="text-body underline">
              #{last.number}
            </Link>
            {last.status === 'open'
              ? chip('fulfilment', last.fulfillmentStatus)
              : chip('order', last.status)}
            {chip('payment', last.paymentStatus)}
          </div>
        </div>
      ) : null}
    </section>
  )
}
