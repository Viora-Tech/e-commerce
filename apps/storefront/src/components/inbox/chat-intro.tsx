'use client'

import type { CardProduct } from '@commerce/core/inbox/server'
import { inboxChatContent as copy } from '@/data/inbox'
import ChatProductCard from './chat-product-card'

type ChatIntroProps = {
  greeting: string
  awayMessage: string
  available: boolean
  storeName: string
  featured: CardProduct[]
  onAsk: (text: string) => void
}

/** Two cards fanned beside the intro, like Shopify Inbox's welcome. */
const TILTS = [-4, 3]

/**
 * What a shopper sees before they write: the greeting (or the away line), up to two featured
 * products, the privacy line and suggested questions. "Track my order" opens the order page.
 */
export default function ChatIntro({
  greeting,
  awayMessage,
  available,
  storeName,
  featured,
  onAsk,
}: ChatIntroProps) {
  // Render logic
  const chips = [
    { key: 'explore', label: copy.chips.explore, ask: copy.chipMessages.explore },
    { key: 'popular', label: copy.chips.popular, ask: copy.chipMessages.popular },
    { key: 'policies', label: copy.chips.policies, ask: copy.chipMessages.policies },
  ]
  const chip =
    'rounded-full border border-[color-mix(in_srgb,currentColor_18%,transparent)] px-3 py-1.5 text-[0.8125rem] transition-[background-color,scale] duration-(--duration-press) ease-out hover:bg-[color-mix(in_srgb,currentColor_6%,transparent)] active:scale-(--motion-press-scale)'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-[1.0625rem] leading-snug font-medium">{greeting || copy.greeting}</p>
          <p className="flex items-center gap-1.5 text-[0.75rem] opacity-70">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${available ? 'bg-[var(--color-success,currentColor)]' : 'bg-[color-mix(in_srgb,currentColor_35%,transparent)]'}`}
            />
            {available ? copy.online : awayMessage || copy.away}
          </p>
        </div>
      </div>
      {featured.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {featured.map((p, i) => (
            <ChatProductCard key={p.id} product={p} tilt={TILTS[i]} />
          ))}
        </div>
      ) : null}
      <p className="text-[0.6875rem] opacity-60">
        {copy.disclaimer(storeName)}{' '}
        <a href="/policies/privacy-policy" className="underline">
          {copy.privacy}
        </a>
      </p>
      <div className="flex flex-wrap gap-2">
        <a href="/track-order" className={chip}>
          {copy.chips.track}
        </a>
        {chips.map((c) => (
          <button key={c.key} type="button" className={chip} onClick={() => onAsk(c.ask)}>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  )
}
