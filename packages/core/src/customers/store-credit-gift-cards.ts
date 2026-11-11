/** SOURCE OF TRUTH: old store-credit gift cards → balance — WHAT: which gift cards were really store credit (refund cards made before the balance existed, and cards the Shopify import brought over), and moving one into its customer's store credit balance: the card's remaining value becomes a ledger credit and the card is emptied and disabled, once / WHY: store credit is a per-customer balance, never a gift card code, so the older cards are folded into the balance with a record on both sides */
import { customer, giftCard, storeCreditEntry } from '@commerce/db'
import { and, asc, eq, gt, ilike, isNull, or } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { changeGiftCardBalance, setGiftCardDisabled, storeToday } from '../gift-cards/service'
import { createCustomer } from './create'
import { changeStoreCredit, StoreCreditError } from './store-credit'
import { storeCreditExpiryAt, storeCreditTimeZone } from './store-credit-expiry'

/*
 * Which cards are listed:
 * - Refund cards this store made before store credit became a balance (#1286): their note starts
 *   "Store credit refund for order #" or "Store credit for return ". Ticked for the merchant.
 * - Cards the Shopify import brought over (`created_by = 'Shopify import'`). Shopify does not say
 *   whether a card was a refund or one a shopper bought, so these start unticked unless their
 *   Shopify note mentions store credit or a refund; staff tick the ones that were store credit.
 * Only live cards with money left in rupees are listed; a card a shopper bought at checkout
 * (`source = 'purchase'`) never is.
 */

const OWN_REFUND_NOTES = ['Store credit refund for order #%', 'Store credit for return %']
const SHOPIFY_IMPORT = 'Shopify import'

export type StoreCreditGiftCard = {
  id: string
  lastCharacters: string
  balancePaise: number
  initialValuePaise: number
  expiresOn: string | null
  note: string | null
  /** Where it came from: a refund card made here, or the Shopify import. */
  origin: 'refund' | 'shopify'
  /** Ticked to start with: it is clearly store credit. */
  suggested: boolean
  /** Whose balance it goes to; null when it will go to a customer found or made by email. */
  customerId: string | null
  customerName: string | null
  email: string | null
  /** Why it cannot be moved as it is; null when it can. */
  problem: 'no_customer' | 'expired' | null
}

const looksLikeStoreCredit = (note: string | null) =>
  Boolean(note && /store credit|refund/i.test(note))

/** The live gift cards that were really store credit, oldest first. */
export async function storeCreditGiftCards(ctx: StoreContext): Promise<StoreCreditGiftCard[]> {
  const today = await storeToday(ctx)
  const rows = await ctx.tx
    .select({
      id: giftCard.id,
      lastCharacters: giftCard.lastCharacters,
      balancePaise: giftCard.balancePaise,
      initialValuePaise: giftCard.initialValuePaise,
      expiresOn: giftCard.expiresOn,
      note: giftCard.note,
      createdBy: giftCard.createdBy,
      customerId: giftCard.customerId,
      customerName: customer.name,
      customerEmail: customer.email,
      recipientEmail: giftCard.recipientEmail,
      recipientName: giftCard.recipientName,
    })
    .from(giftCard)
    .leftJoin(customer, eq(customer.id, giftCard.customerId))
    .where(
      and(
        eq(giftCard.source, 'manual'),
        isNull(giftCard.disabledAt),
        gt(giftCard.balancePaise, 0),
        eq(giftCard.currency, 'INR'),
        or(
          eq(giftCard.createdBy, SHOPIFY_IMPORT),
          ...OWN_REFUND_NOTES.map((n) => ilike(giftCard.note, n)),
        ),
      ),
    )
    .orderBy(asc(giftCard.createdAt), asc(giftCard.id))
  return rows.map((r) => {
    const origin = r.createdBy === SHOPIFY_IMPORT ? 'shopify' : 'refund'
    const email = r.customerEmail ?? r.recipientEmail ?? null
    const expired = Boolean(r.expiresOn && r.expiresOn < today)
    return {
      id: r.id,
      lastCharacters: r.lastCharacters,
      balancePaise: r.balancePaise,
      initialValuePaise: r.initialValuePaise,
      expiresOn: r.expiresOn,
      note: r.note,
      origin,
      suggested: !expired && (origin === 'refund' || looksLikeStoreCredit(r.note)),
      customerId: r.customerId,
      customerName: r.customerName ?? r.recipientName ?? null,
      email,
      problem: expired ? 'expired' : !r.customerId && !email ? 'no_customer' : null,
    }
  })
}

export type GiftCardMoveResult =
  | { giftCardId: string; status: 'moved'; customerId: string; amountPaise: number }
  | { giftCardId: string; status: 'already_moved'; customerId: string; amountPaise: number }
  | {
      giftCardId: string
      status: 'skipped'
      reason: 'not_found' | 'empty' | 'disabled' | 'expired' | 'currency' | 'no_customer'
    }
  | { giftCardId: string; status: 'skipped'; reason: 'refused'; message: string }

/**
 * Moves one card into its customer's store credit balance, in the caller's transaction: the
 * card's remaining value is taken off the card (its history says where it went), the card is
 * disabled so its code no longer works, and the same amount is added to the balance with a
 * ledger line that names the card. The card's row lock and the ledger's one-line-per-card index
 * make it safe to run twice or at once: the second run finds it already moved and changes nothing.
 * A card with an expiry date keeps it: the credit runs out at the end of that day.
 */
export async function moveGiftCardToStoreCredit(
  ctx: StoreContext,
  input: {
    giftCardId: string
    /** For a customer record made from the card's email (it is stored encrypted). */
    secret: string
    staff?: { userId?: string | null | undefined; email?: string | null | undefined } | undefined
  },
): Promise<GiftCardMoveResult> {
  const giftCardId = input.giftCardId
  const [card] = await ctx.tx
    .select()
    .from(giftCard)
    .where(eq(giftCard.id, giftCardId))
    .for('update')
  if (!card) return { giftCardId, status: 'skipped', reason: 'not_found' }
  const [done] = await ctx.tx
    .select({ customerId: storeCreditEntry.customerId, amountPaise: storeCreditEntry.amountPaise })
    .from(storeCreditEntry)
    .where(eq(storeCreditEntry.giftCardId, giftCardId))
  if (done) return { giftCardId, status: 'already_moved', ...done }
  if (card.disabledAt) return { giftCardId, status: 'skipped', reason: 'disabled' }
  if (card.balancePaise <= 0) return { giftCardId, status: 'skipped', reason: 'empty' }
  if (card.currency !== 'INR') return { giftCardId, status: 'skipped', reason: 'currency' }
  if (card.expiresOn && card.expiresOn < (await storeToday(ctx))) {
    return { giftCardId, status: 'skipped', reason: 'expired' }
  }
  const customerId = await holderOf(ctx, card, input.secret)
  if (!customerId) return { giftCardId, status: 'skipped', reason: 'no_customer' }

  const amountPaise = card.balancePaise
  const author = input.staff?.email ?? null
  const expiresAt = card.expiresOn
    ? storeCreditExpiryAt(card.expiresOn, await storeCreditTimeZone(ctx))
    : null
  // The balance first: a refusal (over the most it may hold) leaves the card as it was.
  await changeStoreCredit(ctx, {
    customerId,
    amountPaise,
    kind: 'adjustment',
    reason: `Moved from gift card ending ${card.lastCharacters}`,
    staff: input.staff ?? null,
    giftCardId,
    expiresAt,
  })
  await changeGiftCardBalance(ctx, {
    giftCardId,
    amountPaise: -amountPaise,
    kind: 'adjustment',
    note: "Moved to the customer's store credit balance",
    author,
  })
  await setGiftCardDisabled(ctx, giftCardId, true, author ?? undefined)
  return { giftCardId, status: 'moved', customerId, amountPaise }
}

/**
 * Whose balance the card goes to: its customer, else the store's customer with the card's
 * email, else a new customer record for that email. Null with neither (never a guest code).
 */
async function holderOf(
  ctx: StoreContext,
  card: { customerId: string | null; recipientEmail: string | null; recipientName: string | null },
  secret: string,
): Promise<string | null> {
  if (card.customerId) {
    const [cu] = await ctx.tx
      .select({ id: customer.id })
      .from(customer)
      .where(eq(customer.id, card.customerId))
    if (cu) return cu.id
  }
  const email = card.recipientEmail?.trim().toLowerCase()
  if (!email) return null
  const made = await createCustomer(
    ctx,
    { email, name: card.recipientName ?? undefined },
    { secret, actor: { type: 'system', label: 'Gift card moved to store credit' } },
  )
  if (made.ok) return made.id
  if (made.reason === 'duplicate') return made.existingId
  return null
}

/**
 * Moves each card (see `moveGiftCardToStoreCredit`), each in its own savepoint: a card that is
 * refused (a balance that would go over the most store credit may hold) rolls back alone and
 * the others still move.
 */
export async function moveGiftCardsToStoreCredit(
  ctx: StoreContext,
  input: {
    giftCardIds: readonly string[]
    secret: string
    staff?: { userId?: string | null | undefined; email?: string | null | undefined } | undefined
  },
): Promise<GiftCardMoveResult[]> {
  const results: GiftCardMoveResult[] = []
  for (const giftCardId of [...new Set(input.giftCardIds)]) {
    try {
      results.push(
        await ctx.tx.transaction((sp) =>
          moveGiftCardToStoreCredit(
            { storeId: ctx.storeId, tx: sp },
            { giftCardId, secret: input.secret, staff: input.staff },
          ),
        ),
      )
    } catch (err) {
      if (!(err instanceof StoreCreditError)) throw err
      results.push({ giftCardId, status: 'skipped', reason: 'refused', message: err.message })
    }
  }
  return results
}
