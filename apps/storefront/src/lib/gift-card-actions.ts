'use server'

import 'server-only'

import { findRedeemableGiftCard, GiftCardError } from '@commerce/core'
import { headers } from 'next/headers'
import { clientIp, rateLimited } from './rate-limit'
import { inStore } from './store-context'

const GIFT_CARD_CHECK_RULE = { limit: 10, windowMs: 60_000 }

/** A card the shopper applied at checkout. The code stays in the browser; the server re-checks it on submit. */
export type AppliedGiftCard = { code: string; lastCharacters: string; balancePaise: number }

export type GiftCardCheck = { ok: true; card: AppliedGiftCard } | { ok: false; reason: string }

/** Check a typed code and report its balance. Says why a card cannot be used, never whose it is. */
export async function checkGiftCardAction(code: string): Promise<GiftCardCheck> {
  const h = await headers()
  const storeId = h.get('x-store-id')
  if (!storeId) return { ok: false, reason: 'not_found' }
  // Codes are guessable only by trying them: a handful of checks per minute is plenty.
  const limit = await rateLimited('gift-card-check:ip', clientIp(h), GIFT_CARD_CHECK_RULE)
  if (!limit.ok) return { ok: false, reason: 'rate_limited' }
  try {
    const card = await inStore(storeId, (tx) => findRedeemableGiftCard({ storeId, tx }, code))
    return {
      ok: true,
      card: { code, lastCharacters: card.lastCharacters, balancePaise: card.balancePaise },
    }
  } catch (err) {
    if (err instanceof GiftCardError) return { ok: false, reason: err.reason }
    throw err
  }
}
