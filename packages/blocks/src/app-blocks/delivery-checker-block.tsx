'use client'

import { useState, useTransition } from 'react'

/** Mirrors `@commerce/shipping`'s `DeliveryEstimate`, duplicated so packages/blocks does
 *  not take a dependency on the shipping package for one return type. */
export type DeliveryEstimateResult =
  | {
      ok: true
      serviceable: true
      pincode: string
      dateRange: string
      dispatchesToday: boolean
      dispatchLabel: string
      codAvailable: boolean
      fallback: boolean
    }
  | { ok: true; serviceable: false; pincode: string; reason: string }
  | { ok: false; error: string }

/**
 * What the storefront hands this block through
 * `puck.metadata.appBlockContext.deliveryChecker`. `estimate` is the real
 * `estimateForPincode` path (the same one the buy box's own delivery widget
 * calls), bound to the store by the route.
 */
export type DeliveryCheckerContext = {
  estimate: (pincode: string) => Promise<DeliveryEstimateResult>
}

export type DeliveryCheckerCopy = {
  heading: string
  placeholder: string
  button: string
  checking: string
  change: string
  deliversBy: (range: string) => string
  dispatchToday: string
  dispatchOn: (label: string) => string
  cod: string
  prepaidOnly: string
  fallback: string
  unserviceable: (pincode: string) => string
}

type DeliveryCheckerBlockProps = {
  context: DeliveryCheckerContext | undefined
  copy: DeliveryCheckerCopy
}

function lines(r: DeliveryEstimateResult, copy: DeliveryCheckerCopy): string[] {
  if (!r.ok) return [r.error]
  if (!r.serviceable) return [copy.unserviceable(r.pincode)]
  const out = [
    copy.deliversBy(r.dateRange),
    r.dispatchesToday ? copy.dispatchToday : copy.dispatchOn(r.dispatchLabel),
    r.codAvailable ? copy.cod : copy.prepaidOnly,
  ]
  if (r.fallback) out.push(copy.fallback)
  return out
}

/**
 * App block version of the PIN-code delivery checker (Add panel → Apps), for
 * merchants who want it somewhere other than under the buy box. Owned by
 * whichever shipping connection is enabled (see the plugin's manifest); the
 * estimate itself always comes from the store's one active shipping
 * provider, so which app's copy of this block a merchant adds does not
 * change the answer.
 */
export default function DeliveryCheckerBlock({ context, copy }: DeliveryCheckerBlockProps) {
  // Hooks
  const [pincode, setPincode] = useState('')
  const [result, setResult] = useState<DeliveryEstimateResult | null>(null)
  const [pending, start] = useTransition()

  // Event handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!context) return
    start(async () => setResult(await context.estimate(pincode)))
  }

  const handleChange = () => setResult(null)

  // Early returns
  if (!context) return null

  // Render logic
  const tone = !result ? '' : !result.ok || !result.serviceable ? ' is-negative' : ' is-positive'

  return (
    <div className="delivery-estimate app-block-delivery-checker">
      <p className="delivery-estimate__heading text-caption">{copy.heading}</p>
      {result ? (
        <div className={`delivery-estimate__result${tone}`}>
          {lines(result, copy).map((l) => (
            <p key={l} className="text-small">
              {l}
            </p>
          ))}
          <button type="button" className="delivery-estimate__change" onClick={handleChange}>
            {copy.change}
          </button>
        </div>
      ) : (
        <form className="delivery-estimate__form" onSubmit={handleSubmit}>
          <input
            className="field__input"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder={copy.placeholder}
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            aria-label={copy.placeholder}
          />
          <button
            type="submit"
            className="btn btn--secondary btn--small"
            disabled={pending || pincode.replace(/\D/g, '').length < 6}
          >
            {pending ? copy.checking : copy.button}
          </button>
        </form>
      )}
    </div>
  )
}
