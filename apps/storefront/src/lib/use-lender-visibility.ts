import { normaliseMobile } from '@commerce/core/accounts'
import { isAbroad } from '@commerce/core/checkout-address'
import { useEffect, useRef, useState } from 'react'
import type { CheckoutFormState } from './checkout-form-state'
import { fullNameOf } from './checkout-form-state'
import { lenderVisibleAction } from './lender-visibility-actions'
import type { CheckoutMethod } from './payments'

/** Ways to pay run by a lender that may turn a shopper away before they even pick it. */
const LENDERS = ['snapmint'] as const

/** Ask once the shopper stops typing for this long. */
const ASK_AFTER_MS = 700

/**
 * The checkout's ways to pay without a lender (Snapmint) that cannot serve this shopper:
 * none without a 10-digit Indian mobile on an Indian address (rupees only), and none when the
 * lender's visibility check says no. While the check runs, or when it fails, the option shows
 * (fail open); the lender still decides on its own page. Each answer is remembered per shopper
 * details, so moving between steps asks nothing again.
 */
export function useLenderVisibility(
  methods: CheckoutMethod[],
  form: CheckoutFormState,
  subtotalPaise: number,
  discountPaise = 0,
): CheckoutMethod[] {
  const orderValuePaise = Math.max(0, subtotalPaise - discountPaise)
  const lender = methods.find((m) => (LENDERS as readonly string[]).includes(m.id))
  const phone = normaliseMobile(form.phone)
  const eligible = !!phone && !isAbroad(form.countryCode)
  // The visibility check rounds above ₹10,000 down to 10,000: steps of ₹100 are close enough.
  const roughValue = Math.round(orderValuePaise / 10_000) * 10_000
  const key = lender
    ? [
        lender.id,
        phone,
        roughValue,
        fullNameOf(form),
        form.email,
        form.line1,
        form.line2,
        form.city,
        form.stateCode,
        form.pincode,
      ].join('|')
    : ''
  const answers = useRef(new Map<string, boolean>())
  const [, setAnswered] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` covers every field the check reads.
  useEffect(() => {
    if (!lender || !eligible || answers.current.has(key)) return
    let live = true
    const timer = setTimeout(() => {
      lenderVisibleAction({
        providerId: lender.id,
        amountPaise: roughValue,
        name: fullNameOf(form),
        email: form.email,
        phone: phone ?? '',
        line1: form.line1,
        line2: form.line2,
        city: form.city,
        stateCode: form.stateCode,
        pincode: form.pincode,
      })
        .catch(() => true)
        .then((visible) => {
          answers.current.set(key, visible)
          if (live) setAnswered((n) => n + 1)
        })
    }, ASK_AFTER_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [key, eligible])

  if (!lender) return methods
  const hidden = !eligible || answers.current.get(key) === false
  return hidden ? methods.filter((m) => m.id !== lender.id) : methods
}
