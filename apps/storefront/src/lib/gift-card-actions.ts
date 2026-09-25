'use server'

import 'server-only'

import { findRedeemableGiftCard, GiftCardError } from '@commerce/core'
import { inStore } from './store-context'

/** A card the shopper applied at checkout. The code stays in the browser; the server re-checks it on submit. */
export type AppliedGiftCard = { code: string; lastCharacters: string; balancePaise: number }

export type GiftCardCheck = { ok: true; card: AppliedGiftCard } | { ok: false; reason: string }

/** Check a typed code and report its balance. Says why a card cannot be used, never whose it is. */
export async function checkGiftCardAction(storeId: string, code: string): Promise<GiftCardCheck> {
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
