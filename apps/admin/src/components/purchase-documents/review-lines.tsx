'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Label } from '@commerce/ui/shadcn/label'
import { documentReviewContent } from '@/data/purchase-documents'
import { useCopy } from '@/hooks/use-copy'
import ReviewLineItem from './review-line-item'
import ReviewSection from './review-section'
import {
  type DocumentReview,
  isDraft,
  ownOrder,
  type ReviewLine,
  type ReviewState,
} from './review-state'

type ReviewLinesProps = {
  review: DocumentReview
  state: ReviewState
  onChange: (patch: Partial<ReviewState>) => void
}

/** Each product line the document lists, matched to the order, with what differs. */
export default function ReviewLines({ review, state, onChange }: ReviewLinesProps) {
  // Hooks
  const copy = useCopy(documentReviewContent)

  // Helpers
  const patchLine = (index: number, patch: Partial<ReviewLine>) =>
    onChange({ lines: state.lines.map((l) => (l.index === index ? { ...l, ...patch } : l)) })

  // Early returns
  if (state.shape === 'service_bill') return null

  // Render logic
  const draft = isDraft(review)
  const invoice = state.shape === 'supplier_invoice'
  const sentOrder = ownOrder(review) !== null && !draft

  return (
    <ReviewSection heading={copy.lines.heading}>
      {invoice && (draft || sentOrder) ? (
        <Label className="flex items-start gap-2 text-body font-normal">
          <Checkbox
            checked={state.writeLines}
            onCheckedChange={(v) => onChange({ writeLines: Boolean(v) })}
          />
          <span className="flex flex-col gap-0.5">
            {draft ? copy.lines.update : copy.lines.adjust}
            <span className="text-caption text-muted-foreground">
              {draft ? copy.lines.updateHint : copy.lines.adjustHint}
            </span>
          </span>
        </Label>
      ) : null}
      {state.lines.length === 0 ? (
        <p className="text-body text-muted-foreground">{copy.lines.noLines}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {state.lines.map((line) => (
            <ReviewLineItem
              key={line.index}
              review={review}
              line={line}
              shape={state.shape}
              currency={state.currency}
              draft={draft}
              onChange={(patch) => patchLine(line.index, patch)}
            />
          ))}
        </ul>
      )}
    </ReviewSection>
  )
}
