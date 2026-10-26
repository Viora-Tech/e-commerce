import { formatInZone } from '@commerce/dates'
import { chatOrderStatusLabels, chatTrackContent } from '@/data/chat-track'
import type { ChatOrderView } from '@/lib/chat-track'

type ChatTrackRecentProps = {
  orders: ChatOrderView[]
  onPick: (order: ChatOrderView) => void
}

const copy = chatTrackContent

const row =
  'flex min-h-11 w-full touch-manipulation items-center gap-3 px-3 py-2.5 text-left transition-[background-color] hover:bg-[color-mix(in_srgb,currentColor_5%,transparent)] focus-visible:bg-[color-mix(in_srgb,currentColor_5%,transparent)] focus-visible:outline-none'

/** A signed-in shopper's last orders as compact rows; tapping one opens its card. */
export default function ChatTrackRecent({ orders, onPick }: ChatTrackRecentProps) {
  // Render logic
  return (
    <ul
      aria-label={copy.recent.label}
      className="flex flex-col divide-y divide-[color-mix(in_srgb,currentColor_10%,transparent)] overflow-hidden rounded-[0.875rem] bg-[var(--color-bg,Canvas)] ring-1 ring-[color-mix(in_srgb,currentColor_8%,transparent)]"
    >
      {orders.map((o) => (
        <li key={o.number}>
          <button type="button" className={row} onClick={() => onPick(o)}>
            {o.firstItem?.imageUrl ? (
              // biome-ignore lint/performance/noImgElement: product images on the store's storage host
              <img
                src={o.firstItem.imageUrl}
                alt=""
                className="size-10 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span className="size-10 shrink-0 rounded-lg bg-[color-mix(in_srgb,currentColor_8%,transparent)]" />
            )}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[0.875rem] font-semibold">{copy.card.order(o.number)}</span>
              <span className="truncate text-[0.8125rem] opacity-70">
                {formatInZone(
                  o.placedAt,
                  { day: 'numeric', month: 'short' },
                  { timeZone: o.timeZone },
                )}{' '}
                · {o.total}
              </span>
            </span>
            <span className="shrink-0 text-[0.8125rem] font-medium opacity-80">
              {chatOrderStatusLabels[o.status]}
            </span>
            <span aria-hidden="true" className="shrink-0 opacity-50">
              ›
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
