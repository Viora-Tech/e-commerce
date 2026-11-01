'use client'

import type { CardProduct } from '@commerce/core/inbox/server'
import { inboxChatContent as copy } from '@/data/inbox'
import ChatIcon from './chat-icon'
import ChatProductCard from './chat-product-card'

type ChatIntroProps = {
  greeting: string
  /** Shown under the greeting while the store is away. */
  awayMessage: string | null
  /** "Popular right now"; empty once the shopper has written or is tracking an order. */
  featured: CardProduct[]
  /** Questions the shopper can tap to send (audit #139); empty once they have written. */
  questions: string[]
  onAsk: (text: string) => void
  onTrack: () => void
}

type HelpRow = {
  key: string
  icon: 'parcel' | 'compass' | 'truck'
  title: string
  sub: string
}

const ROWS: HelpRow[] = [
  { key: 'track', icon: 'parcel', ...copy.help.track },
  { key: 'choose', icon: 'compass', ...copy.help.choose },
  { key: 'policies', icon: 'truck', ...copy.help.policies },
]

/**
 * What a shopper sees before they write: "Hi there", the store's greeting, the Quick help rows
 * (track an order in the chat, help choosing, shipping and returns) and the popular products.
 */
export default function ChatIntro({
  greeting,
  awayMessage,
  featured,
  questions,
  onAsk,
  onTrack,
}: ChatIntroProps) {
  // Event handlers
  const handleRow = (key: string) => {
    if (key === 'track') onTrack()
    else if (key === 'choose') onAsk(copy.helpMessages.choose)
    else onAsk(copy.helpMessages.policies)
  }

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[1.375rem]! leading-tight! font-bold! tracking-[-0.01em]!">
          {copy.hello}
        </h2>
        <p className="text-[0.875rem]! leading-relaxed! text-pretty opacity-65">
          {greeting || copy.greeting}
        </p>
        {awayMessage ? (
          <p className="text-[0.8125rem]! leading-relaxed! text-pretty opacity-65">{awayMessage}</p>
        ) : null}
      </div>
      {questions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-[0.75rem]! font-medium! opacity-60">{copy.commonQuestions}</h3>
          <div className="flex flex-wrap gap-2">
            {questions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onAsk(q)}
                className="touch-manipulation rounded-full px-3 py-1.5 text-left text-[0.8125rem]! ring-1 ring-[color-mix(in_srgb,currentColor_12%,transparent)] transition-[background-color] duration-(--duration-press) ease-out hover:bg-[color-mix(in_srgb,currentColor_3%,transparent)] active:bg-[color-mix(in_srgb,currentColor_6%,transparent)]"
              >
                {q}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <nav
        aria-label={copy.quickHelp}
        className="flex flex-col overflow-hidden rounded-[0.875rem] ring-1 ring-[color-mix(in_srgb,currentColor_8%,transparent)]"
      >
        {ROWS.map((row) => (
          <button
            key={row.key}
            type="button"
            onClick={() => handleRow(row.key)}
            className="flex touch-manipulation items-center gap-3 border-[color-mix(in_srgb,currentColor_8%,transparent)] px-3 py-2.5 text-left transition-[background-color] duration-(--duration-press) ease-out not-first:border-t hover:bg-[color-mix(in_srgb,currentColor_3%,transparent)] active:bg-[color-mix(in_srgb,currentColor_6%,transparent)]"
          >
            <span className="flex size-[2.125rem] shrink-0 items-center justify-center rounded-[0.625rem] bg-[color-mix(in_srgb,currentColor_6%,transparent)]">
              <ChatIcon kind={row.icon} className="size-[1.125rem]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[0.875rem]! font-semibold!">{row.title}</span>
              <span className="truncate text-[0.75rem]! opacity-60">{row.sub}</span>
            </span>
            <ChatIcon kind="chevronRight" className="size-4 shrink-0 opacity-40" />
          </button>
        ))}
      </nav>
      {featured.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-[0.75rem]! font-medium! opacity-60">{copy.popular}</h3>
          <div className="grid grid-cols-2 gap-2">
            {featured.map((p) => (
              <ChatProductCard key={p.id} product={p} compact />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
