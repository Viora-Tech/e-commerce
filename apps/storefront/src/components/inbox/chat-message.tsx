'use client'

import type { ShopperMessage } from '@commerce/core/inbox/server'
import { inboxChatContent as copy } from '@/data/inbox'
import type { ChatState } from '@/lib/inbox-actions'
import ChatDiscountCard from './chat-discount-card'
import ChatProductCard from './chat-product-card'

export type ChatMessageView = Omit<ShopperMessage, 'createdAt'> & {
  createdAt: Date | string
  /** Sending, or failed to send (with Retry). Only on the shopper's own optimistic copies. */
  pending?: 'sending' | 'failed' | undefined
}

type ChatMessageProps = {
  message: ChatMessageView
  cards: ChatState['cards']
  seen: boolean
  onRetry: () => void
}

const ids = (payload: Record<string, unknown> | null, key: string): string[] => {
  const v = payload?.[key]
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  return typeof v === 'string' ? [v] : []
}

const text = (payload: Record<string, unknown> | null, key: string) =>
  typeof payload?.[key] === 'string' ? (payload[key] as string) : ''

/** One line of the chat: a bubble, a product or code card, a photo, or a cart line. */
export default function ChatMessage({ message, cards, seen, onRetry }: ChatMessageProps) {
  // Early returns
  if (message.kind === 'system') return null
  if (message.kind === 'cart_event') {
    const p = message.payload
    const title = text(p, 'title')
    const qty = typeof p?.quantity === 'number' ? p.quantity : 1
    const action = text(p, 'action')
    return (
      <p className="py-1 text-center text-[0.75rem] opacity-60">
        {action === 'remove'
          ? copy.cart.remove(title)
          : action === 'quantity'
            ? copy.cart.quantity(title, qty)
            : copy.cart.add(title, qty)}
      </p>
    )
  }

  // Render logic
  const mine = message.sender === 'shopper'
  const align = mine ? 'items-end' : 'items-start'
  const imageUrl = text(message.payload, 'url')
  const products = ids(message.payload, 'productIds').flatMap((id) =>
    cards.products[id] ? [cards.products[id]] : [],
  )
  const discount = cards.discounts[ids(message.payload, 'discountId')[0] ?? '']

  return (
    <div className={`flex flex-col gap-1 ${align}`}>
      {message.kind === 'product' ? (
        <div className="flex w-full flex-col gap-2">
          {products.map((p) => (
            <ChatProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : null}
      {message.kind === 'discount' ? (
        <ChatDiscountCard
          code={discount?.code ?? text(message.payload, 'code')}
          title={discount?.title ?? copy.card.code}
          active={discount?.active ?? true}
        />
      ) : null}
      {message.kind === 'image' && imageUrl ? (
        <a href={imageUrl} target="_blank" rel="noreferrer" className="block max-w-[70%]">
          {/* biome-ignore lint/performance/noImgElement: chat photos live on the store's storage host */}
          <img src={imageUrl} alt="" className="max-h-60 rounded-2xl object-cover" />
        </a>
      ) : null}
      {message.body ? (
        <p
          className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[0.9375rem] leading-snug whitespace-pre-wrap ${
            mine
              ? 'bg-[var(--btn-bg,var(--color-ink,CanvasText))] text-[var(--btn-text,var(--color-bg,Canvas))]'
              : 'bg-[color-mix(in_srgb,currentColor_8%,transparent)]'
          } ${message.pending === 'sending' ? 'opacity-60' : ''}`}
        >
          {message.body}
        </p>
      ) : null}
      {message.pending === 'failed' ? (
        <button type="button" onClick={onRetry} className="text-[0.75rem] underline">
          {copy.failed} {copy.retry}
        </button>
      ) : seen ? (
        <span className="text-[0.6875rem] opacity-60">{copy.seen}</span>
      ) : null}
    </div>
  )
}
