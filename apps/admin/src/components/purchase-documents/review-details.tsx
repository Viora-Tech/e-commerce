'use client'

import { LOW_CONFIDENCE } from '@commerce/ai/client'
import { printedToMinor, purchaseCurrencyOf } from '@commerce/core/inventory'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import DateField from '@/components/fields/date-field'
import { documentReviewContent } from '@/data/purchase-documents'
import { useCopy } from '@/hooks/use-copy'
import { formatMinor } from '@/lib/money'
import ReviewSection from './review-section'
import { type DocumentReview, isDraft, ownOrder, type ReviewState } from './review-state'
import UnsureMark from './unsure-mark'

type ReviewDetailsProps = {
  review: DocumentReview
  state: ReviewState
  onChange: (patch: Partial<ReviewState>) => void
}

type Copy = typeof documentReviewContent
type Fact = { label: string; value: string; unsure: boolean }
type Read = { value: string | number | null; confidence: number }

const fact = (label: string, f: Read): Fact => ({
  label,
  value: f.value === null ? '' : String(f.value),
  unsure: f.value !== null && f.confidence < LOW_CONFIDENCE,
})

/** A printed total as money in the document's currency ("USD 2,660.20"), as printed when the currency is unknown. */
function moneyFact(label: string, f: Read, currency: Read): Fact {
  const code = purchaseCurrencyOf(typeof currency.value === 'string' ? currency.value : null)
  const minor = typeof f.value === 'number' && code ? printedToMinor(f.value, code) : null
  const base = fact(label, f)
  return minor === null || !code ? base : { ...base, value: formatMinor(minor, code) }
}

/** The document's header as the AI read it, by shape. */
function factsOf(extracted: NonNullable<DocumentReview['extracted']>, c: Copy['details']): Fact[] {
  if (extracted.shape === 'supplier_invoice') {
    const d = extracted.data
    return [
      fact(c.supplier, d.supplierName),
      fact(c.number, d.invoiceNumber),
      fact(c.date, d.invoiceDate),
      fact(c.currency, d.currency),
      moneyFact(c.total, d.total, d.currency),
    ]
  }
  if (extracted.shape === 'bill_of_entry') {
    const d = extracted.data
    return [
      fact(c.beNumber, d.beNumber),
      fact(c.date, d.beDate),
      fact(c.port, d.port),
      fact(c.currency, d.currency),
    ]
  }
  const d = extracted.data
  return [
    fact(c.payee, d.payee),
    fact(c.number, d.billNumber),
    fact(c.date, d.billDate),
    fact(c.currency, d.currency),
    moneyFact(c.total, d.total, d.currency),
  ]
}

/** What the document is, the exchange rate to use, and the Bill of Entry details. */
export default function ReviewDetails({ review, state, onChange }: ReviewDetailsProps) {
  // Hooks
  const copy = useCopy(documentReviewContent)

  // Render logic
  const extracted = review.extracted
  const facts = extracted ? factsOf(extracted, copy.details).filter((f) => f.value !== '') : []
  const order = ownOrder(review)
  const showRate =
    state.currency !== 'INR' &&
    state.shape !== 'service_bill' &&
    (order
      ? order.status !== 'cancelled'
      : review.orders.some((o) => o.currency === state.currency))
  const rateHint = !order
    ? copy.rate.applyHint.shipment(state.currency)
    : isDraft(review)
      ? copy.rate.applyHint.order
      : copy.rate.applyHint.locked
  const be = state.billOfEntry

  return (
    <ReviewSection heading={copy.details.heading}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-body">
        {facts.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd className="flex flex-wrap items-center gap-2 tabular-nums">
              {f.value}
              {f.unsure ? <UnsureMark /> : null}
            </dd>
          </div>
        ))}
      </dl>
      {showRate ? (
        <div className="flex flex-col gap-2 border-line border-t pt-3">
          <Label className="flex items-start gap-2 text-body font-normal">
            <Checkbox
              checked={state.setRate}
              onCheckedChange={(v) => onChange({ setRate: Boolean(v) })}
            />
            <span className="flex flex-col gap-0.5">
              {copy.rate.apply(state.currency)}
              <span className="text-caption text-muted-foreground">{rateHint}</span>
            </span>
          </Label>
          <div className="flex items-center gap-3 pl-6">
            <Input
              aria-label={copy.rate.label(state.currency)}
              value={state.fxRate}
              inputMode="decimal"
              placeholder="83.25"
              disabled={!state.setRate}
              className="w-32 text-right tabular-nums"
              onChange={(e) => onChange({ fxRate: e.target.value })}
            />
            <span className="text-caption text-muted-foreground">
              {state.shape === 'bill_of_entry' ? copy.rate.fromBe : copy.rate.label(state.currency)}
            </span>
          </div>
        </div>
      ) : null}
      {state.shape === 'bill_of_entry' && review.shipment ? (
        <div className="flex flex-col gap-2 border-line border-t pt-3">
          <Label className="flex items-center gap-2 text-body font-normal">
            <Checkbox
              checked={state.saveBillOfEntry}
              onCheckedChange={(v) => onChange({ saveBillOfEntry: Boolean(v) })}
            />
            {copy.be.apply}
          </Label>
          <div className="grid gap-2 pl-6 sm:grid-cols-3">
            <Input
              aria-label={copy.details.beNumber}
              value={be.number}
              disabled={!state.saveBillOfEntry}
              onChange={(e) => onChange({ billOfEntry: { ...be, number: e.target.value } })}
            />
            <DateField
              aria-label={copy.details.date}
              value={be.date}
              disabled={!state.saveBillOfEntry}
              onChange={(v) => onChange({ billOfEntry: { ...be, date: v } })}
            />
            <Input
              aria-label={copy.details.port}
              value={be.port}
              disabled={!state.saveBillOfEntry}
              onChange={(e) => onChange({ billOfEntry: { ...be, port: e.target.value } })}
            />
          </div>
        </div>
      ) : null}
    </ReviewSection>
  )
}
