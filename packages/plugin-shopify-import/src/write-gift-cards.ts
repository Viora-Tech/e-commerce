/**
 * Shopify gift cards → ours. Shopify never shares a card's full code (only its
 * last characters), so a card cannot keep working under its old code here.
 * What we do instead, and say so in the report:
 *  - a live card with a balance and a customer gets a NEW code (never one
 *    made to look like the old) holding the same balance, linked to that
 *    customer and not sent yet; the merchant sends it from the card's page;
 *  - a card with no customer, no balance, disabled or expired stays in Shopify.
 * A re-run moves the balance to match Shopify with an adjustment, unless the
 * card has been spent here since, in which case it is left alone.
 */
import {
  changeGiftCardBalance,
  GIFT_CARD_MAX_VALUE_PAISE,
  issueGiftCard,
  setGiftCardDisabled,
  storeToday,
  updateGiftCard,
} from '@commerce/core'
import { customer, giftCard, giftCardTransaction, type StoreTx, store } from '@commerce/db'
import { CURRENCIES, type Currency, formatMoney } from '@commerce/money'
import { and, eq } from 'drizzle-orm'
import { fetchGiftCards } from './api-gift-cards'
import { errorMessage, findMapping, type ImportContext, saveMapping } from './runtime'
import type { ShopifyClient } from './shopify-client'
import type { NGiftCard } from './types'

const R = 'gift_cards'

const amount = (minor: number, currency: string) =>
  formatMoney(minor, currency in CURRENCIES ? (currency as Currency) : 'INR')

async function customerFor(tx: StoreTx, g: NGiftCard): Promise<string | null> {
  if (!g.customer) return null
  const mapped = await findMapping(tx, 'customers', g.customer.sourceId)
  if (mapped) {
    const [row] = await tx.select({ id: customer.id }).from(customer).where(eq(customer.id, mapped))
    if (row) return row.id
  }
  if (!g.customer.email) return null
  const [row] = await tx
    .select({ id: customer.id })
    .from(customer)
    .where(eq(customer.email, g.customer.email))
  return row?.id ?? null
}

async function spentHere(tx: StoreTx, id: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: giftCardTransaction.id })
    .from(giftCardTransaction)
    .where(and(eq(giftCardTransaction.giftCardId, id), eq(giftCardTransaction.kind, 'debit')))
    .limit(1)
  return Boolean(row)
}

/** Why a card stays in Shopify, before looking at customers. Null when it can come over. */
function stays(
  g: NGiftCard,
  today: string,
  currency: string,
): {
  reason: 'gift_card_empty' | 'gift_card_over_limit' | 'gift_card_currency'
  message: string
} | null {
  if (!g.enabled) return { reason: 'gift_card_empty', message: 'Disabled in Shopify' }
  if (g.expiresOn && g.expiresOn < today) {
    return { reason: 'gift_card_empty', message: `Expired on ${g.expiresOn}` }
  }
  if (g.balancePaise <= 0) return { reason: 'gift_card_empty', message: 'No balance left' }
  if (g.currency !== currency) {
    return {
      reason: 'gift_card_currency',
      message: `Balance is in ${g.currency}; your store sells in ${currency}`,
    }
  }
  if (g.balancePaise > GIFT_CARD_MAX_VALUE_PAISE) {
    return {
      reason: 'gift_card_over_limit',
      message: `Balance ${amount(g.balancePaise, g.currency)} is over the ${amount(GIFT_CARD_MAX_VALUE_PAISE, currency)} a gift card can hold here`,
    }
  }
  return null
}

async function writeGiftCard(
  ctx: ImportContext,
  g: NGiftCard,
  today: string,
  currency: string,
): Promise<void> {
  const ref = `•••• ${g.lastCharacters}`
  try {
    const existingId = await ctx.inStore(async (tx) => {
      const mapped = await findMapping(tx, R, g.sourceId)
      if (!mapped) return null
      const [row] = await tx
        .select({ id: giftCard.id })
        .from(giftCard)
        .where(eq(giftCard.id, mapped))
      return row?.id ?? null
    })
    const why = stays(g, today, currency)
    if (why && !existingId) {
      ctx.report.count(R, 'skipped')
      ctx.report.leave(R, why.reason)
      ctx.report.issue({ resource: R, ref, message: `${why.message}; not imported` })
      return
    }
    const customerId = await ctx.inStore((tx) => customerFor(tx, g))
    // A preview runs before customers are imported; a Shopify customer will be there by then.
    if (!customerId && !existingId && !(ctx.dryRun && g.customer)) {
      ctx.report.count(R, 'skipped')
      ctx.report.leave(R, 'gift_card_no_customer')
      ctx.report.issue({
        resource: R,
        ref,
        message: `${amount(g.balancePaise, g.currency)} left, but no customer to give a new code to. The holder can still use it on Shopify, or you can issue them a card here`,
      })
      return
    }
    if (ctx.dryRun) {
      ctx.report.count(R, existingId ? 'updated' : 'created')
      if (!existingId) ctx.report.leave(R, 'gift_card_code')
      ctx.report.sample({
        resource: R,
        key: g.sourceId,
        title: ref,
        action: existingId ? 'update' : 'create',
        detail: `${amount(g.balancePaise, g.currency)} for ${g.customer?.email ?? g.customer?.name ?? 'a customer'}`,
      })
      return
    }
    await ctx.inStore(async (tx) => {
      const scope = { tx, storeId: ctx.storeId }
      if (existingId) {
        if (await spentHere(tx, existingId)) {
          ctx.report.leave(R, 'gift_card_used_here')
          ctx.report.issue({
            resource: R,
            ref,
            message: 'Already spent in this store, so its balance here was kept as it is',
          })
          return
        }
        const [card] = await tx
          .select({ balance: giftCard.balancePaise })
          .from(giftCard)
          .where(eq(giftCard.id, existingId))
        const target = why ? 0 : g.balancePaise
        const delta = target - (card?.balance ?? 0)
        if (delta !== 0) {
          await changeGiftCardBalance(scope, {
            giftCardId: existingId,
            amountPaise: delta,
            kind: 'adjustment',
            note: 'Matched to the Shopify balance on re-import',
            author: 'Shopify import',
          })
        }
        await updateGiftCard(scope, existingId, { expiresOn: g.expiresOn })
        await setGiftCardDisabled(scope, existingId, !g.enabled)
        return
      }
      const issued = await issueGiftCard(
        scope,
        {
          valuePaise: g.balancePaise,
          expiresOn: g.expiresOn,
          customerId,
          recipientEmail: g.customer?.email ?? null,
          recipientName: g.customer?.name ?? null,
          note: [
            `Imported from Shopify gift card ending ${g.lastCharacters} (issued at ${amount(g.initialPaise, g.currency)}). New code; send it to the customer.`,
            g.note,
          ]
            .filter(Boolean)
            .join(' '),
          createdBy: 'Shopify import',
        },
        ctx.secret,
      )
      if (issued) await saveMapping(tx, ctx.storeId, R, g.sourceId, issued.card.id)
    })
    ctx.report.count(R, existingId ? 'updated' : 'created')
    if (!existingId) ctx.report.leave(R, 'gift_card_code')
  } catch (err) {
    ctx.report.count(R, 'failed')
    ctx.report.issue({ resource: R, ref, sourceId: g.sourceId, message: errorMessage(err) })
  }
}

export async function importGiftCards(
  ctx: ImportContext,
  client: ShopifyClient,
  /** On a retry, only these Shopify gift card ids. */
  only: ReadonlySet<string> | null = null,
): Promise<void> {
  ctx.report.begin(R)
  const { today, currency } = await ctx.inStore(async (tx) => {
    const [s] = await tx
      .select({ currency: store.currency })
      .from(store)
      .where(eq(store.id, ctx.storeId))
    return { today: await storeToday({ tx, storeId: ctx.storeId }), currency: s?.currency ?? 'INR' }
  })
  for await (const page of fetchGiftCards(client)) {
    const batch = only ? page.filter((g) => only.has(g.sourceId)) : page
    ctx.report.addTotal(R, batch.length)
    for (const g of batch) {
      await writeGiftCard(ctx, g, today, currency)
      await ctx.report.flush()
    }
  }
}
