'use client'

import { announceCartAdded, useFormatPaise } from '@commerce/blocks'
import type { CardProduct } from '@commerce/core/inbox/server'
import { useState } from 'react'
import { inboxChatContent as copy } from '@/data/inbox'
import { addLineAction } from '@/lib/cart-actions'

type ChatProductCardProps = {
  product: CardProduct
  /** The featured cards beside the intro are tilted like Shopify Inbox's. */
  tilt?: number | undefined
}

/** A product shared in the chat: picture, title, price, View and Add to cart. */
export default function ChatProductCard({ product, tilt }: ChatProductCardProps) {
  // Hooks
  const formatPaise = useFormatPaise()
  const [state, setState] = useState<'idle' | 'adding' | 'added'>('idle')

  // Event handlers
  const handleAdd = async () => {
    if (!product.variantId || state === 'adding') return
    setState('adding')
    try {
      await addLineAction(product.variantId, 1)
      announceCartAdded()
      setState('added')
    } catch {
      setState('idle')
    }
  }

  // Render logic
  const href = `/products/${encodeURIComponent(product.handle)}`

  return (
    <div
      style={tilt ? { rotate: `${tilt}deg` } : undefined}
      className="flex items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,currentColor_12%,transparent)] bg-[var(--color-bg,Canvas)] p-2.5 shadow-sm"
    >
      <a href={href} className="shrink-0">
        {product.imageUrl ? (
          // biome-ignore lint/performance/noImgElement: product images on the store's storage host
          <img src={product.imageUrl} alt="" className="size-14 rounded-xl object-cover" />
        ) : (
          <span className="block size-14 rounded-xl bg-[color-mix(in_srgb,currentColor_8%,transparent)]" />
        )}
      </a>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <a href={href} className="truncate text-[0.875rem] font-medium">
          {product.title}
        </a>
        {product.minPricePaise !== null ? (
          <span className="text-[0.8125rem] opacity-70">{formatPaise(product.minPricePaise)}</span>
        ) : null}
        {product.available ? (
          <button
            type="button"
            onClick={handleAdd}
            disabled={state !== 'idle'}
            className="w-fit rounded-full bg-[var(--btn-bg,var(--color-ink,CanvasText))] px-3 py-1 text-[0.75rem] font-medium text-[var(--btn-text,var(--color-bg,Canvas))] transition-[scale] duration-(--duration-press) ease-out active:scale-(--motion-press-scale) disabled:opacity-60"
          >
            {state === 'added' ? copy.card.added : copy.card.addToCart}
          </button>
        ) : (
          <span className="text-[0.75rem] opacity-60">{copy.card.soldOut}</span>
        )}
      </div>
    </div>
  )
}
