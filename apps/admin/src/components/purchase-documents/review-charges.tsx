'use client'

import type { PurchaseChargeKind } from '@commerce/core/inventory'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import OptionSelect from '@/components/landed-cost/option-select'
import { documentReviewContent } from '@/data/purchase-documents'
import { chargesContent, PURCHASE_CHARGE_KINDS } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import ReviewSection from './review-section'
import { type ReviewCharge, type ReviewState, splitsPerLine } from './review-state'

type ReviewChargesProps = {
  state: ReviewState
  onChange: (patch: Partial<ReviewState>) => void
}

/** Duty, freight, clearing and bank amounts the document adds as charges, each one ticked or not. */
export default function ReviewCharges({ state, onChange }: ReviewChargesProps) {
  // Hooks
  const { charges: copy } = useCopy(documentReviewContent)
  const { kinds } = useCopy(chargesContent)

  // Helpers
  const patchCharge = (key: string, patch: Partial<ReviewCharge>) =>
    onChange({ charges: state.charges.map((c) => (c.key === key ? { ...c, ...patch } : c)) })

  // Early returns
  if (state.charges.length === 0 && state.shape === 'supplier_invoice') return null

  // Render logic
  return (
    <ReviewSection heading={copy.heading}>
      {state.charges.length === 0 ? (
        <p className="text-body text-muted-foreground">{copy.none}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {state.charges.map((c) => (
            <li key={c.key} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2">
                <Checkbox
                  aria-label={c.label}
                  checked={c.apply}
                  onCheckedChange={(v) => patchCharge(c.key, { apply: Boolean(v) })}
                />
                <span className="min-w-0 flex-1 truncate text-body">{c.label}</span>
                <span className="w-60 max-w-[50%]">
                  <OptionSelect<PurchaseChargeKind>
                    id={`charge-kind-${c.key}`}
                    options={PURCHASE_CHARGE_KINDS}
                    labels={kinds}
                    value={c.kind}
                    onChange={(kind) => patchCharge(c.key, { kind })}
                  />
                </span>
              </div>
              <div className="ml-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <span className="text-caption text-muted-foreground">
                    {copy.amount} ({c.currency})
                  </span>
                  <Input
                    aria-label={`${copy.amount} (${c.currency})`}
                    value={c.amount}
                    inputMode="decimal"
                    disabled={!c.apply}
                    className="text-right tabular-nums"
                    onChange={(e) => patchCharge(c.key, { amount: e.target.value })}
                  />
                </div>
                {c.currency === 'INR' ? null : (
                  <div className="flex flex-col gap-1">
                    <span className="text-caption text-muted-foreground">
                      {copy.rate(c.currency)}
                    </span>
                    <Input
                      aria-label={copy.rate(c.currency)}
                      value={c.fxRate}
                      inputMode="decimal"
                      placeholder="83.25"
                      disabled={!c.apply}
                      className="text-right tabular-nums"
                      onChange={(e) => patchCharge(c.key, { fxRate: e.target.value })}
                    />
                  </div>
                )}
                {c.dutyColumn ? null : (
                  <div className="flex flex-col gap-1">
                    <span className="text-caption text-muted-foreground">{copy.gst}</span>
                    <Input
                      aria-label={copy.gst}
                      value={c.gst}
                      inputMode="decimal"
                      disabled={!c.apply}
                      className="text-right tabular-nums"
                      onChange={(e) => patchCharge(c.key, { gst: e.target.value })}
                    />
                  </div>
                )}
              </div>
              {c.dutyColumn ? (
                <p className="ml-6 text-caption text-muted-foreground">
                  {splitsPerLine(state, c) ? copy.perLine : copy.byValue}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </ReviewSection>
  )
}
