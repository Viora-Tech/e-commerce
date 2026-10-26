import { formatInZone } from '@commerce/dates'
import {
  chatOrderStatusLabels,
  chatPaidByLabels,
  chatPaymentLabels,
  chatTrackContent,
} from '@/data/chat-track'
import type { ChatOrderStatus, ChatOrderView } from '@/lib/chat-track'
import ChatOrderTimeline from './chat-order-timeline'

type ChatOrderCardProps = {
  order: ChatOrderView
  /** Sends a chat message as the shopper. */
  onAsk: (text: string) => void
}

const copy = chatTrackContent.card

const card =
  'flex flex-col gap-3.5 rounded-[0.875rem] bg-[var(--color-bg,Canvas)] p-3.5 ring-1 ring-[color-mix(in_srgb,currentColor_8%,transparent)]'

const button =
  'flex min-h-11 flex-1 touch-manipulation items-center justify-center rounded-[0.625rem] px-3 text-[0.875rem]! font-semibold! transition-[background-color,scale] duration-(--duration-press) ease-out active:scale-(--motion-press-scale)'

const chip =
  'min-h-11 touch-manipulation rounded-full px-3.5 text-[0.8125rem]! shadow-[0_0_0_1px_color-mix(in_srgb,currentColor_18%,transparent)] transition-[background-color,scale] duration-(--duration-press) ease-out hover:bg-[color-mix(in_srgb,currentColor_6%,transparent)] active:scale-(--motion-press-scale)'

const PILL_GOOD =
  'bg-[color-mix(in_srgb,var(--color-success,currentColor)_14%,transparent)] text-[var(--color-success,currentColor)]'
const PILL_BAD =
  'bg-[color-mix(in_srgb,var(--color-danger,currentColor)_12%,transparent)] text-[var(--color-danger,currentColor)]'
const PILL_NEUTRAL = 'bg-[color-mix(in_srgb,currentColor_8%,transparent)]'

const PILL: Record<ChatOrderStatus, string> = {
  confirmed: PILL_NEUTRAL,
  packed: PILL_NEUTRAL,
  shipped: PILL_NEUTRAL,
  out_for_delivery: PILL_NEUTRAL,
  delivered: PILL_GOOD,
  cancelled: PILL_BAD,
  refunded: PILL_BAD,
  returning: PILL_BAD,
}

const day = (value: string, timeZone: string) =>
  formatInZone(value, { day: 'numeric', month: 'short' }, { timeZone })

/** A courier's "YYYY-MM-DD" read at noon UTC, so no zone moves it to the day before. */
const calendarDay = (ymd: string, timeZone: string) => day(`${ymd}T12:00:00Z`, timeZone)

/** "Placed 24 Oct · ₹3,499 · Paid by UPI". */
function subline(o: ChatOrderView): string {
  const money = o.paidBy ? copy.paidBy(chatPaidByLabels[o.paidBy]) : chatPaymentLabels[o.payment]
  return [copy.placed(day(o.placedAt, o.timeZone)), o.total, money].join(' · ')
}

/** "Delhivery · AWB 1234", "AWB 1234" when the courier has no name here. */
function shippedDetail(o: ChatOrderView): string | undefined {
  if (!o.shipment) return undefined
  return [o.shipment.courier, copy.awb(o.shipment.waybill)].filter(Boolean).join(' · ')
}

function deliveredDetail(o: ChatOrderView): string | undefined {
  if (o.deliveredAt) return copy.deliveredOn(day(o.deliveredAt, o.timeZone))
  if (o.expectedDate) return copy.expected(calendarDay(o.expectedDate, o.timeZone))
  return undefined
}

/** One order in the chat: number, money, first item, where it is, and what to do next. */
export default function ChatOrderCard({ order, onAsk }: ChatOrderCardProps) {
  // Render logic
  const item = order.firstItem
  const shipped = shippedDetail(order)
  const delivered = deliveredDetail(order)
  const trackingUrl = order.shipment?.trackingUrl ?? null
  const ended =
    order.status === 'cancelled' || order.status === 'refunded' || order.status === 'returning'
      ? copy.ended[order.status]
      : null
  // The address can still change while the parcel is on its way, not once it arrived.
  const canChangeAddress = order.steps !== null && order.status !== 'delivered'

  return (
    <div className="flex flex-col gap-2.5">
      <article className={card} aria-label={copy.order(order.number)}>
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="text-[0.9375rem]! font-semibold!">{copy.order(order.number)}</h3>
            <p className="text-[0.8125rem]! opacity-70">{subline(order)}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[0.75rem]! font-semibold! ${PILL[order.status]}`}
          >
            {chatOrderStatusLabels[order.status]}
          </span>
        </header>

        {item ? (
          <div className="flex items-center gap-3">
            {item.imageUrl ? (
              // biome-ignore lint/performance/noImgElement: product images on the store's storage host
              <img
                src={item.imageUrl}
                alt=""
                className="size-12! shrink-0 rounded-lg object-cover!"
              />
            ) : (
              <span className="size-12 shrink-0 rounded-lg bg-[color-mix(in_srgb,currentColor_8%,transparent)]" />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[0.875rem]! font-medium!">{item.title}</span>
              <span className="text-[0.8125rem]! opacity-70">
                {[item.variant, copy.qty(item.quantity)].filter(Boolean).join(' · ')}
                {order.moreItems > 0 ? ` · ${copy.more(order.moreItems)}` : ''}
              </span>
            </div>
          </div>
        ) : null}

        {order.steps ? (
          <ChatOrderTimeline
            steps={order.steps}
            details={{
              ...(shipped ? { shipped } : {}),
              ...(delivered ? { delivered } : {}),
            }}
          />
        ) : (
          <p className="text-[0.875rem]! leading-snug!">{ended}</p>
        )}

        <div className="flex gap-2">
          {trackingUrl && order.steps ? (
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${button} bg-(--chat-accent)! text-(--chat-on-accent)!`}
            >
              {copy.liveTracking}
            </a>
          ) : null}
          <a
            href={order.viewUrl}
            className={`${button} shadow-[0_0_0_1px_color-mix(in_srgb,currentColor_18%,transparent)] hover:bg-[color-mix(in_srgb,currentColor_6%,transparent)]`}
          >
            {copy.viewOrder}
          </a>
        </div>
      </article>

      <div className="flex flex-wrap gap-2">
        {canChangeAddress ? (
          <button
            type="button"
            className={chip}
            onClick={() => onAsk(chatTrackContent.messages.changeAddress(order.number))}
          >
            {copy.changeAddress}
          </button>
        ) : null}
        <button
          type="button"
          className={chip}
          onClick={() => onAsk(chatTrackContent.messages.talkToPerson(order.number))}
        >
          {copy.talkToPerson}
        </button>
      </div>
    </div>
  )
}
