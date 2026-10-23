'use client'

import { CheckIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { documentReviewContent, purchaseDocumentsContent } from '@/data/purchase-documents'
import { chargesContent } from '@/data/purchasing'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import ReviewCharges from './review-charges'
import ReviewDetails from './review-details'
import ReviewLines from './review-lines'
import ReviewPreview from './review-preview'
import { type DocumentReview, initialReview, type ReviewState, toApplyInput } from './review-state'

type ReviewDialogProps = {
  id: string
  onOpenChange: (open: boolean) => void
  onApplied: () => void
  onReset: () => void
}

const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback)

/** The document on the left, what the AI read on the right; nothing is saved until Apply. */
export default function ReviewDialog({ id, onOpenChange, onApplied, onReset }: ReviewDialogProps) {
  // Hooks
  const copy = useCopy(documentReviewContent)
  const docCopy = useCopy(purchaseDocumentsContent)
  const chargeCopy = useCopy(chargesContent)
  const fmt = useFormat()
  const [review, setReview] = useState<DocumentReview | null>(null)
  const [state, setState] = useState<ReviewState | null>(null)
  const [file, setFile] = useState<{ url: string; type: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: loaded once per document; the labels are read at that moment
  useEffect(() => {
    let cancelled = false
    let url: string | null = null
    Promise.all([api.purchaseDocuments.review({ id }), api.purchaseDocuments.download({ id })])
      .then(([r, f]) => {
        if (cancelled) return
        url = URL.createObjectURL(f)
        setFile({ url, type: f.type })
        setReview(r)
        setState(
          initialReview(r, {
            freight: copy.charges.freight,
            insurance: copy.charges.insurance,
            duty: {
              bcd: chargeCopy.kinds.customs_bcd,
              sws: chargeCopy.kinds.customs_sws,
              igst: chargeCopy.kinds.customs_igst,
            },
          }),
        )
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [id])

  // Helpers
  const patch = (next: Partial<ReviewState>) => setState((s) => (s ? { ...s, ...next } : s))

  // Event handlers
  const handleApply = async () => {
    if (!review || !state) return
    const built = toApplyInput(review, state, copy.lines.adjustNote(review.document.fileName))
    if ('problem' in built) {
      toast.error(copy[built.problem])
      return
    }
    setBusy(true)
    try {
      await api.purchaseDocuments.apply(built.input)
      toast.success(copy.applied)
      onApplied()
    } catch (err) {
      toast.error(message(err, docCopy.failed))
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async () => {
    if (!review) return
    try {
      await api.purchaseDocuments.reset({ id: review.document.id })
      toast.success(copy.resetDone)
      setReview({ ...review, document: { ...review.document, status: 'ready', appliedAt: null } })
      onReset()
    } catch (err) {
      toast.error(message(err, docCopy.failed))
    }
  }

  // Render logic
  const applied = review?.document.status === 'applied'
  const title = review ? copy.title(docCopy.kinds[review.document.kind]) : copy.loading

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92dvh] max-h-[92dvh] w-full flex-col gap-0 p-0 sm:max-w-[min(96vw,90rem)]">
        <DialogHeader className="border-line border-b px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{failed ? copy.loadFailed : copy.intro}</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <ReviewPreview file={file} name={review?.document.fileName ?? ''} />
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain bg-muted/30 p-4 sm:p-5">
            {applied && review?.document.appliedAt ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary-soft px-4 py-3 text-body text-ink-strong">
                <span>{copy.appliedNote(fmt.date(review.document.appliedAt))}</span>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  {copy.reset}
                </Button>
              </div>
            ) : null}
            {review && state ? (
              <>
                <ReviewDetails review={review} state={state} onChange={patch} />
                <ReviewLines review={review} state={state} onChange={patch} />
                <ReviewCharges state={state} onChange={patch} />
              </>
            ) : (
              <p className="py-10 text-center text-body text-muted-foreground">
                {failed ? copy.loadFailed : copy.loading}
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="border-line border-t px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button onClick={handleApply} disabled={busy || !state || applied}>
            <CheckIcon aria-hidden="true" />
            {busy ? copy.applying : copy.apply}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
