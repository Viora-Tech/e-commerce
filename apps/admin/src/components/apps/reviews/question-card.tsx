'use client'

import { ANSWER_MAX } from '@commerce/plugin-reviews/settings'
import { EyeOff, Send, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import OrderChip from '@/components/orders/order-chip'
import { reviewToolsContent } from '@/data/review-tools'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Row = Awaited<ReturnType<typeof api.reviews.questions.list>>['rows'][number]

type QuestionCardProps = {
  question: Row
  onChanged: () => void
}

/** One shopper question: the product, who asked and when, the answer box and its actions. */
export default function QuestionCard({ question, onChanged }: QuestionCardProps) {
  // Hooks
  const { questions: copy } = useCopy(reviewToolsContent)
  const format = useFormat()
  const [answer, setAnswer] = useState(question.answer ?? '')
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Helpers
  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await work()
      toast.success(done)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handlePublish = () =>
    run(
      () => api.reviews.questions.answer({ id: question.id, answer, publish: true }),
      answer.trim() ? copy.published : copy.saved,
    )
  const handleSave = () =>
    run(() => api.reviews.questions.answer({ id: question.id, answer, publish: false }), copy.saved)
  const handleHide = () =>
    run(
      () => api.reviews.questions.setStatus({ ids: [question.id], status: 'hidden' }),
      copy.hidden,
    )
  const handleDelete = async () => {
    await api.reviews.questions.delete({ ids: [question.id] })
    toast.success(copy.deleted)
    onChanged()
  }

  // Render logic
  const changed = answer.trim() !== (question.answer ?? '')

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-body-strong">{question.question}</p>
          <span className="text-caption text-muted-foreground">
            {copy.asked(question.askerName, format.date(new Date(question.createdAt)))}{' '}
            <Link
              href={routes.products.detail(question.productId)}
              className="text-link hover:underline"
            >
              {question.productTitle}
            </Link>
          </span>
        </div>
        <OrderChip kind="review" value={question.status} />
      </div>
      <Textarea
        aria-label={copy.answer}
        placeholder={copy.answerPlaceholder}
        value={answer}
        maxLength={ANSWER_MAX}
        rows={3}
        onChange={(e) => setAnswer(e.target.value)}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => setDeleting(true)} disabled={busy}>
          <Trash2 aria-hidden="true" />
          {copy.delete}
        </Button>
        {question.status !== 'hidden' && (
          <Button variant="outline" onClick={handleHide} disabled={busy}>
            <EyeOff aria-hidden="true" />
            {copy.hide}
          </Button>
        )}
        <Button variant="outline" onClick={handleSave} disabled={busy || !changed}>
          {copy.save}
        </Button>
        <Button onClick={handlePublish} disabled={busy || !answer.trim()}>
          <Send aria-hidden="true" />
          {question.status === 'published' && !changed ? copy.republish : copy.publish}
        </Button>
      </div>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={copy.deleteTitle}
        body={copy.deleteBody}
        confirmLabel={copy.delete}
        tone="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
