'use server'

import 'server-only'

import { logger } from '@commerce/observability/logging'
import { loadPincodeDirectory } from '@commerce/shipping/pincode-directory'
import { headers } from 'next/headers'
import { clientIp, rateLimited } from './rate-limit'

const LOOKUP_IP_RULE = { limit: 60, windowMs: 60_000 }

export type PincodePlaceView = { city: string; stateCode: string }

/**
 * Checkout's "PIN code first": the district and state for a PIN code, looked
 * up on the server so the directory never ships to the browser. Null when the
 * code is unknown, the directory is not installed, or the caller is too busy;
 * the shopper then types city and state as before.
 */
export async function lookupPincodeAction(pincode: string): Promise<PincodePlaceView | null> {
  const limit = await rateLimited('pincode-lookup:ip', clientIp(await headers()), LOOKUP_IP_RULE)
  if (!limit.ok) return null
  try {
    const place = (await loadPincodeDirectory())?.lookup(pincode) ?? null
    return place ? { city: place.district, stateCode: place.stateCode } : null
  } catch (err) {
    logger.error('PIN code directory could not be read', { error: err })
    return null
  }
}
