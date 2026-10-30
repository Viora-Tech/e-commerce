'use client'

import { announceCartAdded, useFormatPaise } from '@commerce/blocks'
import type { CardProduct } from '@commerce/core/inbox/server'
import { useState } from 'react'
import { inboxChatContent as copy } from '@/data/inbox'
import { addLineAction } from '@/lib/cart-actions'

type ChatProductCardProps = {
  product: CardProduct
  /** The intro's "Popular right now" grid: picture, title and price, the whole card a link. */
  compact?: boolean | undefined
}

/** A product shared in the chat: picture, title, price and Add to cart. */
export default function ChatProductCard({ product, compact }: ChatProductCardProps) {
  // Hooks
  const formatPaise = useFormatPaise()
  const [state, setState] = useState<'idle' | 'adding' | 'added'>('idle')

  // Event handlers
  const handleAdd = async () => {
    if (!product.variantId || state === 'adding') return
    setState('adding')
    try {
      // Refused (a pre-order campaign keeping pre-orders apart, #143): nothing was added.
      const refused = await addLineAction(product.variantId, 1)
      if (!refused) announceCartAdded()
      setState(refused ? 'idle' : 'added')
    } catch {
      setState('idle')
    }
  }

  // Render logic
  const href = `/products/${encodeURIComponent(product.handle)}`
  const price = product.minPricePaise !== null ? formatPaise(product.minPricePaise) : null
  const placeholder = 'bg-[color-mix(in_srgb,currentColor_6%,transparent)]'

  return compact ? (
    <a
      href={href}
      className="flex min-w-0 flex-col gap-2 rounded-[0.875rem] p-1.5 ring-1 ring-[color-mix(in_srgb,currentColor_8%,transparent)] transition-[scale,background-color] duration-(--duration-press) ease-out hover:bg-[color-mix(in_srgb,currentColor_3%,transparent)] active:scale-(--motion-card-press-scale)"
    >
      {product.imageUrl ? (
        // biome-ignore lint/performance/noImgElement: product images on the store's storage host
        <img
          src={product.imageUrl}
          alt=""
          className={`aspect-square! h-auto! w-full! rounded-[0.625rem] object-cover! ${placeholder}`}
        />
      ) : (
        <span className={`block aspect-square w-full rounded-[0.625rem] ${placeholder}`} />
      )}
      <span className="flex min-w-0 flex-col gap-0.5 px-1 pb-1">
        <span className="truncate text-[0.8125rem]! font-medium!">{product.title}</span>
        {price ? <span className="text-[0.75rem]! opacity-60 tabular-nums">{price}</span> : null}
      </span>
    </a>
  ) : (
    <div className="flex w-full max-w-[85%] items-center gap-3 rounded-[0.875rem] bg-[var(--color-bg,Canvas)] p-2 ring-1 ring-[color-mix(in_srgb,currentColor_10%,transparent)]">
      <a href={href} className="shrink-0">
        {product.imageUrl ? (
          // biome-ignore lint/performance/noImgElement: product images on the store's storage host
          <img
            src={product.imageUrl}
            alt=""
            className={`size-14! rounded-[0.625rem] object-cover! ${placeholder}`}
          />
        ) : (
          <span className={`block size-14 rounded-[0.625rem] ${placeholder}`} />
        )}
      </a>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <a href={href} className="truncate text-[0.875rem]! font-medium!">
          {product.title}
        </a>
        {price ? <span className="text-[0.8125rem]! opacity-60 tabular-nums">{price}</span> : null}
        {product.available ? (
          <button
            type="button"
            onClick={handleAdd}
            disabled={state !== 'idle'}
            className="w-fit touch-manipulation rounded-full bg-(--chat-accent)! px-3 py-1 text-[0.75rem]! font-medium! text-(--chat-on-accent)! transition-[scale,opacity] duration-(--duration-press) ease-out active:scale-(--motion-press-scale) disabled:opacity-60"
          >
            {state === 'added' ? copy.card.added : copy.card.addToCart}
          </button>
        ) : (
          <span className="text-[0.75rem]! opacity-60">{copy.card.soldOut}</span>
        )}
      </div>
    </div>
  )
}
