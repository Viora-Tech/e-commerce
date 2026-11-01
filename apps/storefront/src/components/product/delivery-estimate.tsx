'use client'

import type { DeliveryEstimate } from '@commerce/core'
import { useState, useTransition } from 'react'
import { deliveryEstimateContent as content } from '@/data/product'
import { estimateDeliveryAction } from '@/lib/shipping-actions'

/** What the widget says once it has an answer; the ordering is the persuasion order. */
function lines(r: DeliveryEstimate): string[] {
  if (!r.ok) return [r.error]
  if (!r.serviceable) return [content.unserviceable(r.pincode)]
  const out = [
    content.deliversBy(r.dateRange),
    r.dispatchesToday ? content.dispatchToday : content.dispatchOn(r.dispatchLabel),
    r.codAvailable ? content.cod : content.prepaidOnly,
  ]

  if (r.fallback) out.push(content.fallback)
  return out
}

/**
 * The last answer in this tab. Add to cart refreshes the page, which mounts the widget afresh;
 * the shopper's checked PIN code and its answer stay instead of resetting (#119).
 */
let remembered: { pincode: string; result: DeliveryEstimate | null } = {
  pincode: '',
  result: null,
}

/** PIN code → honest delivery window under the add-to-cart button. */
export default function DeliveryEstimateWidget() {
  // Hooks
  const [pincode, setPincode] = useState(() => remembered.pincode)
  const [result, setResult] = useState<DeliveryEstimate | null>(() => remembered.result)
  const [pending, start] = useTransition()

  // Event handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    start(async () => {
      const next = await estimateDeliveryAction(pincode)
      remembered = { pincode, result: next }
      setResult(next)
    })
  }

  const handleChange = () => {
    remembered = { pincode, result: null }
    setResult(null)
  }

  // Render logic
  const tone = !result ? '' : !result.ok || !result.serviceable ? ' is-negative' : ' is-positive'

  return (
    <div className="delivery-estimate">
      <p className="delivery-estimate__heading text-caption">{content.heading}</p>
      {result ? (
        <div className={`delivery-estimate__result${tone}`}>
          {lines(result).map((l) => (
            <p key={l} className="text-small">
              {l}
            </p>
          ))}
          <button type="button" className="delivery-estimate__change" onClick={handleChange}>
            {content.change}
          </button>
        </div>
      ) : (
        <form className="delivery-estimate__form" onSubmit={handleSubmit}>
          <input
            className="field__input"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder={content.placeholder}
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            aria-label={content.placeholder}
          />
          <button
            type="submit"
            className="btn btn--secondary btn--small"
            disabled={pending || pincode.replace(/\D/g, '').length < 6}
          >
            {pending ? content.checking : content.button}
          </button>
        </form>
      )}
    </div>
  )
}
