'use client'

import type { ShopperMessage } from '@commerce/core/inbox/server'
import { inboxChatContent as copy } from '@/data/inbox'
import type { ChatState } from '@/lib/inbox-actions'
import ChatDiscountCard from './chat-discount-card'
import ChatIcon from './chat-icon'
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
  storeName: string
  /** First of a run from this sender: draws the "Assistant" label or the staff avatar. */
  first: boolean
  /** A person took over from the assistant with this message: draws the "joined" divider. */
  joined: boolean
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
export default function ChatMessage({
  message,
  cards,
  seen,
  storeName,
  first,
  joined,
  onRetry,
}: ChatMessageProps) {
  // Early returns
  if (message.kind === 'system') return null
  if (message.kind === 'cart_event') {
    const p = message.payload
    const title = text(p, 'title')
    const qty = typeof p?.quantity === 'number' ? p.quantity : 1
    const action = text(p, 'action')
    return (
      <p className="py-1 text-center text-[0.75rem]! opacity-55">
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
  const ai = message.sender === 'ai'
  const staff = !mine && !ai
  const imageUrl = text(message.payload, 'url')
  const products = ids(message.payload, 'productIds').flatMap((id) =>
    cards.products[id] ? [cards.products[id]] : [],
  )
  const discount = cards.discounts[ids(message.payload, 'discountId')[0] ?? '']
  const initial = storeName.trim().charAt(0).toUpperCase() || '?'

  return (
    <div className="flex flex-col gap-3">
      {joined ? (
        <div className="flex items-center gap-3 py-1 text-[0.6875rem]! opacity-55">
          <span className="h-px flex-1 bg-current opacity-20" />
          <span className="shrink-0">{copy.joined(storeName)}</span>
          <span className="h-px flex-1 bg-current opacity-20" />
        </div>
      ) : null}
      <div className={`flex items-end gap-2 ${mine ? 'justify-end' : ''}`}>
        {staff ? (
          first ? (
            <span
              aria-hidden="true"
              className="mb-0.5! flex size-6 shrink-0 items-center justify-center self-start rounded-full bg-[var(--color-ink,CanvasText)] text-[0.6875rem]! font-semibold! text-[var(--color-bg,Canvas)]"
            >
              {initial}
            </span>
          ) : (
            <span aria-hidden="true" className="w-6 shrink-0" />
          )
        ) : null}
        <div className={`flex min-w-0 flex-1 flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
          {ai && first ? (
            <span className="flex items-center gap-1 text-[0.6875rem]! font-medium! opacity-60">
              <ChatIcon kind="sparkle" className="size-3" />
              {copy.assistant}
            </span>
          ) : null}
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
              <img
                src={imageUrl}
                alt=""
                className={`max-h-60! rounded-2xl object-cover! ${mine ? 'rounded-br-[0.25rem]' : 'rounded-bl-[0.25rem]'}`}
              />
            </a>
          ) : null}
          {message.body ? (
            <p
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[0.9375rem]! leading-snug! break-words whitespace-pre-wrap transition-opacity duration-(--duration-press) ${
                mine
                  ? 'rounded-br-[0.25rem] bg-(--chat-accent)! text-(--chat-on-accent)!'
                  : 'rounded-bl-[0.25rem] bg-[color-mix(in_srgb,currentColor_6%,transparent)]'
              } ${message.pending === 'sending' ? 'opacity-60' : ''}`}
            >
              {message.body}
            </p>
          ) : null}
          {message.pending === 'failed' ? (
            <button
              type="button"
              onClick={onRetry}
              className="touch-manipulation text-[0.75rem]! text-[var(--color-danger,currentColor)] underline underline-offset-2"
            >
              {copy.failed} {copy.retry}
            </button>
          ) : seen ? (
            <span className="text-[0.6875rem]! opacity-55">{copy.seen}</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
