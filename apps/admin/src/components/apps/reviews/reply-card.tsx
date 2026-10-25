'use client'

import { AiIcon, Send, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type ReplyCardProps = {
  reviewId: string
  reply: string | null
  onSaved: () => void
}

const MAX = 2000

/**
 * The store's public reply. "Write with AI" shows only when the AI writer is on for the
 * store and the member may use it (`ai.status`); it suggests, the merchant posts.
 */
export default function ReplyCard({ reviewId, reply, onSaved }: ReplyCardProps) {
  // Hooks
  const { detail } = useCopy(reviewsContent)
  const [text, setText] = useState(reply ?? '')
  const [busy, setBusy] = useState(false)
  const [writing, setWriting] = useState(false)
  const [aiOn, setAiOn] = useState(false)
  useEffect(() => {
    api.ai
      .status()
      .then((s) => setAiOn(s.productWriter))
      .catch(() => setAiOn(false))
  }, [])

  // Helpers
  const save = async (next: string) => {
    setBusy(true)
    try {
      const r = await api.reviews.reply({ id: reviewId, text: next })
      toast.success(
        !next.trim()
          ? detail.reply.removed
          : r.emailed
            ? detail.reply.emailed
            : detail.reply.posted,
      )
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : reviewsContent.list.failed)
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleWrite = async () => {
    setWriting(true)
    try {
      const r = await api.reviews.writeReply({ id: reviewId })
      setText(r.reply)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : reviewsContent.list.failed)
    } finally {
      setWriting(false)
    }
  }

  // Render logic
  const copy = detail.reply
  const changed = text.trim() !== (reply ?? '').trim()

  return (
    <DataCard title={copy.title}>
      <div className="flex flex-col gap-3">
        <p className="text-caption text-muted-foreground">{copy.help}</p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          placeholder={copy.placeholder}
          rows={4}
          aria-label={copy.title}
          disabled={writing}
        />
        <div className="flex flex-wrap items-center gap-2">
          {aiOn ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleWrite}
              disabled={writing || busy}
            >
              {writing ? <Spinner /> : <AiIcon />}
              {writing ? copy.aiBusy : copy.ai}
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => save(text)}
            disabled={busy || writing || !text.trim() || !changed}
          >
            {busy ? <Spinner /> : <Send aria-hidden="true" />}
            {reply ? copy.update : copy.post}
          </Button>
          {reply ? (
            <Button type="button" variant="ghost" onClick={() => save('')} disabled={busy}>
              <Trash2 aria-hidden="true" />
              {copy.remove}
            </Button>
          ) : null}
        </div>
      </div>
    </DataCard>
  )
}
