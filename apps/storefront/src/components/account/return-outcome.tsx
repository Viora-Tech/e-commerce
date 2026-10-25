'use client'

import type { ReturnPreference } from '@commerce/core/returns'
import { returnsContent } from '@/data/returns'
import type { ReturnFormLine } from './return-form'

type ReturnOutcomeProps = {
  className: string
  /** The lines the shopper ticked. */
  lines: ReturnFormLine[]
  preference: ReturnPreference
  /** Picked replacement variant per order line. */
  swaps: Record<string, string>
  disabled: boolean
  onPreference: (p: ReturnPreference) => void
  onSwap: (lineId: string, variantId: string) => void
}

const copy = returnsContent.form

const PREFERENCES: ReturnPreference[] = ['refund', 'exchange', 'store_credit']

/** "What would you like?": money back, store credit, or another variant of each item. */
export default function ReturnOutcome({
  className,
  lines,
  preference,
  swaps,
  disabled,
  onPreference,
  onSwap,
}: ReturnOutcomeProps) {
  // Render logic
  const swappable = lines.some((l) => l.swaps.length > 0)
  const options = PREFERENCES.filter((p) => p !== 'exchange' || swappable)

  return (
    <fieldset className={className}>
      <legend className="sr-only">{copy.outcomeHeading}</legend>
      <h3 className="h4">{copy.outcomeHeading}</h3>
      <div className="flex flex-col gap-3">
        {options.map((p) => (
          <label key={p} className="flex items-center gap-3 text-body">
            <input
              type="radio"
              name="outcome"
              className="size-5 shrink-0"
              checked={preference === p}
              disabled={disabled}
              onChange={() => onPreference(p)}
            />
            {copy.outcomes[p]}
          </label>
        ))}
      </div>
      {preference === 'exchange' ? (
        <ul className="flex flex-col gap-3">
          {lines.map((l) => (
            <li key={l.id} className="flex flex-col gap-1">
              <span className="text-body font-medium">
                {l.title}
                {l.variantTitle ? ` (${l.variantTitle})` : ''}
              </span>
              {l.swaps.length > 0 ? (
                <label className="field">
                  <span className="field__label text-small">{copy.swapFor}</span>
                  <select
                    className="field__input"
                    value={swaps[l.id] ?? ''}
                    disabled={disabled}
                    onChange={(e) => onSwap(l.id, e.target.value)}
                  >
                    <option value="">{copy.swapPick}</option>
                    {l.swaps.map((s) => (
                      <option key={s.variantId} value={s.variantId}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className="text-small text-muted">{copy.noSwaps}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  )
}
