/**
 * Composing a delivery estimate - the one place the pure modules are joined up:
 *
 *   pincode.ts        is this even a PIN code?
 *   the policy        where does this store ship from, and on which days?
 *   a provider        can a courier take it, and how many days?
 *   delivery-date.ts  what calendar date is that, in the store's timezone?
 *
 * Both the storefront widget and the admin "try a PIN" panel call this, so the
 * merchant diagnosing "why does my product page say X" sees the SAME answer
 * the customer got. Returns plain objects; who is asking decides the transport.
 */

import { CourierError } from './courier-error'
import {
  computeDeliveryEstimate,
  type DispatchPolicy,
  formatDeliveryRange,
  formatShortDate,
  ImpossibleCalendarError,
} from './delivery-date'
import { parsePincode } from './pincode'
import type { Serviceability, ShippingProvider } from './types'

/** Per-store shipping policy, as stored in settings. */
export type ShippingPolicy = DispatchPolicy & {
  originPincode: string
  /** Used when the courier does not report a transit time. */
  defaultMinTransitDays: number
  defaultMaxTransitDays: number
  /** Merchant switch; COD is offered only when this AND the courier say yes. */
  codAllowed: boolean
}

export type DeliveryEstimate =
  | {
      ok: true
      serviceable: true
      pincode: string
      codAvailable: boolean
      /** "Tue, 18 Aug - Thu, 20 Aug" */
      dateRange: string
      earliestDate: string
      latestDate: string
      dispatchDate: string
      dispatchLabel: string
      dispatchesToday: boolean
      /** True when the courier did not answer and configured days were used. */
      fallback: boolean
      provider: string
    }
  | { ok: true; serviceable: false; pincode: string; reason: string }
  | { ok: false; error: string }

export type EstimateSource = Pick<ShippingProvider, 'id' | 'checkServiceability'>

/** The app's own words for a failure. The courier's never reach a customer. */
export function describeCourierFailure(error: unknown): string {
  if (error instanceof CourierError) {
    if (error.kind === 'auth') return 'The courier rejected our credentials.'
    if (error.kind === 'timeout' || error.kind === 'unavailable') return 'The courier did not answer.'
    if (error.kind === 'rate_limited') return 'The courier is rate limiting us.'
    return 'The courier answered with an error.'
  }
  return error instanceof Error ? error.message : 'The lookup failed.'
}

/**
 * Ask the courier, then turn its answer into dates.
 *
 * A courier that fails is not fatal: the estimate falls back to the
 * merchant's configured transit days, marked `fallback: true`, because one
 * carrier's outage must not take the delivery promise off a product page.
 * A courier that says "no" IS the answer and is returned as unserviceable.
 */
export async function estimateDelivery(input: {
  pincode: unknown
  policy: ShippingPolicy
  provider: EstimateSource | null
  now: Date
  /** Cached lookup for this pincode, when the caller has one. */
  cached?: Serviceability | null | undefined
}): Promise<DeliveryEstimate> {
  const parsed = parsePincode(input.pincode)
  if (!parsed.ok) return { ok: false, error: parsed.message }
  const { policy } = input

  let answer: Serviceability | null = input.cached ?? null
  let fallback = false
  if (!answer && input.provider) {
    try {
      answer = await input.provider.checkServiceability({
        originPincode: policy.originPincode,
        destinationPincode: parsed.pincode,
      })
    } catch (error) {
      fallback = true
      // biome-ignore lint/suspicious/noConsole: the failure must be visible to the operator
      console.warn(`[shipping] ${input.provider.id} lookup failed: ${describeCourierFailure(error)}`)
    }
  }
  if (!input.provider) fallback = true

  if (answer && !answer.serviceable) {
    return {
      ok: true,
      serviceable: false,
      pincode: parsed.pincode,
      reason: answer.reason ?? 'We do not deliver to this PIN code yet.',
    }
  }

  try {
    const estimate = computeDeliveryEstimate({
      now: input.now,
      minTransitDays: answer?.minTransitDays ?? policy.defaultMinTransitDays,
      maxTransitDays: answer?.maxTransitDays ?? policy.defaultMaxTransitDays,
      policy,
    })
    return {
      ok: true,
      serviceable: true,
      pincode: parsed.pincode,
      codAvailable: policy.codAllowed && (answer?.codAvailable ?? true),
      dateRange: formatDeliveryRange(estimate.earliestDate, estimate.latestDate),
      earliestDate: estimate.earliestDate,
      latestDate: estimate.latestDate,
      dispatchDate: estimate.dispatchDate,
      dispatchLabel: formatShortDate(estimate.dispatchDate),
      dispatchesToday: estimate.dispatchesToday,
      fallback,
      provider: answer?.provider ?? input.provider?.id ?? 'policy',
    }
  } catch (error) {
    if (error instanceof ImpossibleCalendarError) return { ok: false, error: error.message }
    throw error
  }
}
