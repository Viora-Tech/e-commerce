'use client'

import { AiIcon, RefreshCw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { inboxConversationsContent } from '@/data/inbox-conversations'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type SuggestedRepliesProps = {
  conversationId: string
  /** The shopper's message that waits for a reply; suggestions are drafted for it. */
  messageId: string
  /** Puts a draft in the reply box; the member edits it and sends it. */
  onPick: (text: string) => void
}

/** Drafts already written this session, by shopper message: reopening a chat costs nothing. */
const drafted = new Map<string, string[]>()

const messageOf = (err: unknown) => (err instanceof Error && err.message ? err.message : null)

/**
 * Up to three AI reply drafts above the reply box, for the shopper's latest message, grounded
 * in the store's products, policies, shipping and the shopper's orders. A click only fills the
 * reply box: nothing is sent until a person sends it.
 */
export default function SuggestedReplies({
  conversationId,
  messageId,
  onPick,
}: SuggestedRepliesProps) {
  // Hooks
  const copy = useCopy(inboxConversationsContent)
  const [replies, setReplies] = useState<string[] | null>(drafted.get(messageId) ?? null)
  const [error, setError] = useState<string | null>(null)
  const [round, setRound] = useState(0)

  useEffect(() => {
    if (round === 0 && drafted.has(messageId)) {
      setReplies(drafted.get(messageId) ?? [])
      return
    }
    let alive = true
    setReplies(null)
    setError(null)
    api.inbox
      .suggestReplies({ id: conversationId })
      .then((r) => {
        drafted.set(messageId, r.replies)
        if (alive) setReplies(r.replies)
      })
      .catch((err: unknown) => {
        if (!alive) return
        setReplies([])
        setError(messageOf(err) ?? copy.failed)
      })
    return () => {
      alive = false
    }
  }, [conversationId, messageId, round, copy.failed])

  // Render logic
  const a = copy.assist
  const loading = replies === null

  return (
    <section
      aria-label={a.suggested}
      className="flex flex-col gap-2 border-t border-hairline px-3 pt-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-eyebrow text-muted-foreground">
          <AiIcon className="size-3.5" aria-hidden="true" />
          {a.suggested}
        </h3>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={a.regenerate}
          title={a.regenerate}
          disabled={loading}
          onClick={() => setRound((n) => n + 1)}
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
      {loading ? (
        <div className="flex flex-col gap-1.5" role="status" aria-label={a.writing}>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-4/5" />
        </div>
      ) : error ? (
        <p className="text-caption text-muted-foreground">{error}</p>
      ) : replies.length === 0 ? (
        <p className="text-caption text-muted-foreground">{a.none}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {replies.map((reply) => (
            <li key={reply} className="min-w-0 max-w-full">
              <button
                type="button"
                title={reply}
                className="motion-press max-w-full rounded-2xl border border-hairline bg-background px-3 py-1.5 text-left text-caption text-ink-strong hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onPick(reply)}
              >
                <span className="line-clamp-2">{reply}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!loading && !error && replies.length > 0 ? (
        <p className="text-caption text-muted-foreground">{a.hint}</p>
      ) : null}
    </section>
  )
}
