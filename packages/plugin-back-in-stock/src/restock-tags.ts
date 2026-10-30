import { randomBytes } from 'node:crypto'
import { customer, product, type StoreTx, variant } from '@commerce/db'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { variantIsEligible } from './eligibility'
import { backInStockSignup } from './schema'
import { availableStockFor } from './stock'

/** The customer tag a Shopify restock app leaves: `restock-<product handle>`. */
export const RESTOCK_TAG = /^restock-(.+)$/i

export type RestockTagsResult = {
  /** Signups added (one per customer and sold-out variant). */
  added: number
  /** Tags whose product is not here (or matches more than one), with how many customers carry each. */
  unmatched: { tag: string; customers: number }[]
}

/**
 * The tagged product: its handle, else the one product whose handle starts with the tag's
 * text (apps cut long handles short). Null when none, or more than one, fits.
 */
function productFor(handle: string, products: { id: string; handle: string }[]) {
  const exact = products.find((p) => p.handle === handle)
  if (exact) return exact
  const prefixed = products.filter((p) => p.handle.startsWith(handle))
  return prefixed.length === 1 ? (prefixed[0] ?? null) : null
}

/**
 * "Bring over restock tags": Waimers' Shopify restock app marked waiting shoppers with
 * `restock-dysphoria-mio`-style customer tags, so here nobody was waiting and nobody would be
 * told when stock came back (audit #198). Each tagged customer with an email joins the waiting
 * list of the product's sold-out variants, already confirmed (they asked on Shopify), carrying
 * the usual unsubscribe link. Running it again adds nothing twice.
 */
export async function importRestockTags(
  tx: StoreTx,
  storeId: string,
): Promise<RestockTagsResult> {
  const tagged = await tx
    .select({ email: customer.email, tags: customer.tags })
    .from(customer)
    .where(
      and(
        isNotNull(customer.email),
        sql`exists (select 1 from unnest(${customer.tags}) t where t ilike 'restock-%')`,
      ),
    )
  const products = await tx.select({ id: product.id, handle: product.handle }).from(product)
  const waiting = new Map<string, Set<string>>()
  for (const c of tagged) {
    const email = c.email?.trim().toLowerCase()
    if (!email) continue
    for (const tag of c.tags) {
      const m = tag.trim().match(RESTOCK_TAG)
      if (!m) continue
      const key = (m[1] ?? '').toLowerCase()
      const set = waiting.get(key) ?? new Set<string>()
      set.add(email)
      waiting.set(key, set)
    }
  }

  let added = 0
  const unmatched: RestockTagsResult['unmatched'] = []
  const now = new Date()
  for (const [handle, emails] of waiting) {
    const p = productFor(handle, products)
    if (!p) {
      unmatched.push({ tag: `restock-${handle}`, customers: emails.size })
      continue
    }
    const variants = await tx
      .select({ id: variant.id })
      .from(variant)
      .where(eq(variant.productId, p.id))
    const soldOut: string[] = []
    for (const v of variants) {
      if (!(await variantIsEligible(tx, v.id))) continue
      if ((await availableStockFor(tx, v.id)) <= 0) soldOut.push(v.id)
    }
    for (const variantId of soldOut) {
      for (const email of emails) {
        const rows = await tx
          .insert(backInStockSignup)
          .values({
            storeId,
            variantId,
            productId: p.id,
            email,
            status: 'confirmed',
            consentAt: now,
            confirmedAt: now,
            unsubscribeToken: randomBytes(24).toString('base64url'),
          })
          .onConflictDoNothing()
          .returning({ id: backInStockSignup.id })
        added += rows.length
      }
    }
  }
  unmatched.sort((a, b) => b.customers - a.customers)
  return { added, unmatched }
}
