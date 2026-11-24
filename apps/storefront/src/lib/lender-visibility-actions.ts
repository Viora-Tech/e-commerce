'use server'

import 'server-only'

import { INDIAN_STATE_NAMES } from '@commerce/core'
import { normaliseMobile } from '@commerce/core/accounts'
import { headers } from 'next/headers'
import { storePaymentProviders } from './payments'
import { clientIp, rateLimited } from './rate-limit'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'

/** Typing the address asks a few times; the hook also remembers each answer. */
const VISIBILITY_IP_RULE = { limit: 30, windowMs: 60_000 }

export type LenderVisibilityInput = {
  /** The provider to ask (`snapmint`). */
  providerId: string
  amountPaise: number
  name: string
  email: string
  phone: string
  line1: string
  line2: string
  city: string
  stateCode: string
  pincode: string
}

const clip = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')

/**
 * Checkout asks whether a lender (Snapmint) would offer this shopper EMI, so one it would turn
 * away is not shown the option. True whenever we cannot tell: over the rate limit, a provider
 * without the check, or the lender not answering in time (the provider fails open itself).
 */
export async function lenderVisibleAction(input: LenderVisibilityInput): Promise<boolean> {
  const phone = normaliseMobile(clip(input.phone, 20))
  if (!phone) return false
  const storeId = await requestStoreId()
  const ip = clientIp(await headers())
  if (!(await rateLimited('lender-visibility:ip', `${storeId}:${ip}`, VISIBILITY_IP_RULE)).ok) {
    return true
  }
  const provider = await inStore(storeId, async (tx) =>
    (await storePaymentProviders(tx, storeId)).find((p) => p.id === input.providerId),
  )
  if (!provider?.checkAvailability) return true
  const stateCode = clip(input.stateCode, 8)
  const name = clip(input.name, 200)
  return provider.checkAvailability({
    amountPaise: Math.max(0, Math.round(Number(input.amountPaise) || 0)),
    customer: { name, email: clip(input.email, 200) || undefined, phone, ip },
    shipping: {
      name,
      line1: clip(input.line1, 200),
      line2: clip(input.line2, 200) || undefined,
      city: clip(input.city, 100),
      state: stateCode,
      stateName: INDIAN_STATE_NAMES[stateCode.toUpperCase()],
      postalCode: clip(input.pincode, 10),
      country: 'IN',
    },
  })
}
