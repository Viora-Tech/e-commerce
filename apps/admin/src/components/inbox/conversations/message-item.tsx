'use client'

import { BadgePercent, Lock } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Bubble, BubbleContent } from '@commerce/ui/shadcn/bubble'
import { Message, MessageContent, MessageFooter } from '@commerce/ui/shadcn/message'
import RelativeTime from '@/components/layout/relative-time'
import ProductThumb from '@/components/products/product-thumb'
import { inboxConversationsContent } from '@/data/inbox-conversations'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import { systemLine } from '@/lib/inbox-view'

export type ThreadData = Awaited<ReturnType<typeof api.inbox.get>>
export type ThreadMessage = ThreadData['messages'][number]
export type ThreadCards = ThreadData['cards']

type MessageItemProps = {
  message: ThreadMessage
  cards: ThreadCards
  /** Shows "Seen" under the last staff message the shopper has seen. */
  seen: boolean
  nameOfMember: (userId: string) => string
}

const ids = (payload: Record<string, unknown> | null, key: string): string[] => {
  const v = payload?.[key]
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  return typeof v === 'string' ? [v] : []
}

/** One line of a thread: a shopper or staff bubble, a note, a card, or a system or cart line. */
export default function MessageItem({ message, cards, seen, nameOfMember }: MessageItemProps) {
  // Hooks
  const copy = useCopy(inboxConversationsContent)
  const fmt = useFormat()

  // Early returns
  if (message.kind === 'system' || message.kind === 'cart_event') {
    const text = systemLine(message.kind, message.payload, copy, nameOfMember)
    if (!text) return null
    return (
      <p className="py-1 text-center text-caption text-muted-foreground">
        {text} · <RelativeTime value={message.createdAt} />
      </p>
    )
  }

  // Render logic
  const t = copy.thread
  const fromShopper = message.sender === 'shopper'
  const note = message.kind === 'note'
  const products = ids(message.payload, 'productIds').map((id) => ({ id, p: cards.products[id] }))
  const discount = cards.discounts[ids(message.payload, 'discountId')[0] ?? '']
  const imageUrl = typeof message.payload?.url === 'string' ? message.payload.url : null
  const author = fromShopper
    ? null
    : message.memberUserId
      ? nameOfMember(message.memberUserId)
      : null

  return (
    <Message align={fromShopper ? 'start' : 'end'}>
      <MessageContent>
        {message.kind === 'product' ? (
          <div className="flex max-w-[80%] flex-col gap-2 self-end">
            {products.map(({ id, p }) =>
              p ? (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-hairline bg-card p-2"
                >
                  <ProductThumb url={p.imageUrl} className="size-12" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body-strong">{p.title}</span>
                    <span className="text-caption text-muted-foreground">
                      {p.minPricePaise === null ? '' : fmt.money(p.minPricePaise)}
                      {p.active ? '' : ` · ${t.card.inactive}`}
                    </span>
                  </span>
                </div>
              ) : (
                <p key={id} className="text-caption text-muted-foreground">
                  {t.card.missing}
                </p>
              ),
            )}
          </div>
        ) : message.kind === 'discount' ? (
          <div className="flex items-center gap-3 self-end rounded-xl border border-hairline bg-card px-3 py-2">
            <BadgePercent className="size-5" aria-hidden="true" />
            <span className="flex flex-col">
              <span className="font-mono text-body-strong">
                {discount?.code ?? String(message.payload?.code ?? '')}
              </span>
              <span className="text-caption text-muted-foreground">
                {discount?.title ?? t.card.discount}
                {discount && !discount.active ? ` · ${t.card.inactive}` : ''}
              </span>
            </span>
          </div>
        ) : message.kind === 'image' && imageUrl ? (
          <a
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            className={cn('block max-w-[60%]', fromShopper ? 'self-start' : 'self-end')}
          >
            {/* biome-ignore lint/performance/noImgElement: chat images live on the store's storage host */}
            <img src={imageUrl} alt={t.card.image} className="max-h-64 rounded-xl object-cover" />
          </a>
        ) : null}
        {message.body ? (
          <Bubble
            variant={fromShopper ? 'muted' : note ? 'outline' : 'default'}
            align={fromShopper ? 'start' : 'end'}
          >
            <BubbleContent className={cn('whitespace-pre-wrap', note && 'border-dashed')}>
              {note ? (
                <span className="mb-1 flex items-center gap-1 text-caption font-medium text-muted-foreground">
                  <Lock className="size-3" aria-hidden="true" />
                  {t.note}
                </span>
              ) : null}
              {message.body}
            </BubbleContent>
          </Bubble>
        ) : null}
      </MessageContent>
      <MessageFooter>
        <span className="text-caption text-muted-foreground">
          {author ? `${author} · ` : ''}
          <RelativeTime value={message.createdAt} />
          {seen ? ` · ${t.seen}` : ''}
        </span>
      </MessageFooter>
    </Message>
  )
}
