/** SOURCE OF TRUTH: where products and variants are placed — WHAT: which shipping profile each product and variant is in, read and written / WHY: the quote, the profile page and the writes share one reading of the rule in profiles.ts */
import {
  product,
  type StoreTx,
  shippingProfileProduct,
  shippingProfileVariant,
  variant,
} from '@commerce/db'
import { and, eq, inArray, notInArray } from 'drizzle-orm'
import { lineProfileId } from './profiles'

/** Each custom profile's products: whole ones and those with a variant placed there alone. */
export async function profileProducts(tx: StoreTx): Promise<Map<string, Set<string>>> {
  const whole = await tx
    .select({
      profileId: shippingProfileProduct.profileId,
      productId: shippingProfileProduct.productId,
    })
    .from(shippingProfileProduct)
  const alone = await tx
    .select({ profileId: shippingProfileVariant.profileId, productId: variant.productId })
    .from(shippingProfileVariant)
    .innerJoin(variant, eq(variant.id, shippingProfileVariant.variantId))
  const out = new Map<string, Set<string>>()
  for (const r of [...whole, ...alone]) {
    out.set(r.profileId, (out.get(r.profileId) ?? new Set<string>()).add(r.productId))
  }
  return out
}

/** Put exactly `productIds` in a custom profile; products in another profile move here. */
export async function syncProducts(
  tx: StoreTx,
  storeId: string,
  profileId: string,
  productIds: readonly string[],
): Promise<void> {
  const wanted = [...new Set(productIds)]
  await tx
    .delete(shippingProfileProduct)
    .where(
      wanted.length
        ? and(
            eq(shippingProfileProduct.profileId, profileId),
            notInArray(shippingProfileProduct.productId, wanted),
          )
        : eq(shippingProfileProduct.profileId, profileId),
    )
  if (wanted.length === 0) return
  // Only this store's products (RLS hides the rest), so a foreign id is dropped, not linked.
  const known = await tx.select({ id: product.id }).from(product).where(inArray(product.id, wanted))
  if (known.length === 0) return
  await tx
    .insert(shippingProfileProduct)
    .values(known.map((p) => ({ storeId, profileId, productId: p.id })))
    .onConflictDoUpdate({
      target: [shippingProfileProduct.storeId, shippingProfileProduct.productId],
      set: { profileId },
    })
}

/**
 * Put exactly `variantIds` in a custom profile on their own; a variant placed alone in another
 * profile moves here (a variant is in one profile at most). Undefined leaves them as they are.
 */
export async function syncVariants(
  tx: StoreTx,
  storeId: string,
  profileId: string,
  variantIds: readonly string[] | undefined,
): Promise<void> {
  if (variantIds === undefined) return
  const wanted = [...new Set(variantIds)]
  await tx
    .delete(shippingProfileVariant)
    .where(
      wanted.length
        ? and(
            eq(shippingProfileVariant.profileId, profileId),
            notInArray(shippingProfileVariant.variantId, wanted),
          )
        : eq(shippingProfileVariant.profileId, profileId),
    )
  if (wanted.length === 0) return
  // RLS again: another store's variant id is dropped.
  const known = await tx.select({ id: variant.id }).from(variant).where(inArray(variant.id, wanted))
  if (known.length === 0) return
  await tx
    .insert(shippingProfileVariant)
    .values(known.map((v) => ({ storeId, profileId, variantId: v.id })))
    .onConflictDoUpdate({
      target: [shippingProfileVariant.storeId, shippingProfileVariant.variantId],
      set: { profileId },
    })
}

/** The custom profile each product is in; products missing from the map ship under General. */
export async function productProfiles(
  tx: StoreTx,
  productIds: readonly string[],
): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map()
  const rows = await tx
    .select({
      productId: shippingProfileProduct.productId,
      profileId: shippingProfileProduct.profileId,
    })
    .from(shippingProfileProduct)
    .where(inArray(shippingProfileProduct.productId, [...new Set(productIds)]))
  return new Map(rows.map((r) => [r.productId, r.profileId]))
}

/** The profile each variant was placed in on its own; missing ones follow their product. */
export async function variantProfiles(
  tx: StoreTx,
  variantIds: readonly string[],
): Promise<Map<string, string>> {
  if (variantIds.length === 0) return new Map()
  const rows = await tx
    .select({
      variantId: shippingProfileVariant.variantId,
      profileId: shippingProfileVariant.profileId,
    })
    .from(shippingProfileVariant)
    .where(inArray(shippingProfileVariant.variantId, [...new Set(variantIds)]))
  return new Map(rows.map((r) => [r.variantId, r.profileId]))
}

export type Placeable = { variantId: string; productId: string }

/** The profile each shipping line ships under (variant, then product, then General). */
export async function lineProfiles(
  tx: StoreTx,
  lines: readonly Placeable[],
  generalId: string,
): Promise<(line: Placeable) => string> {
  const byProduct = await productProfiles(
    tx,
    lines.map((l) => l.productId),
  )
  const byVariant = await variantProfiles(
    tx,
    lines.map((l) => l.variantId),
  )
  return (line) => lineProfileId(line, byVariant, byProduct, generalId)
}

/**
 * Move products back to General (its page's "Move products here"): take them, and every one of
 * their variants placed on its own, out of whatever custom profile holds them. General holds
 * every product not placed elsewhere, so removing the placement is the whole move.
 */
export async function moveProductsToGeneral(
  tx: StoreTx,
  productIds: readonly string[],
): Promise<{ moved: number }> {
  const ids = [...new Set(productIds)]
  if (ids.length === 0) return { moved: 0 }
  const fromProducts = await tx
    .delete(shippingProfileProduct)
    .where(inArray(shippingProfileProduct.productId, ids))
    .returning({ productId: shippingProfileProduct.productId })
  const variantIds = (
    await tx.select({ id: variant.id }).from(variant).where(inArray(variant.productId, ids))
  ).map((v) => v.id)
  const fromVariants = variantIds.length
    ? await tx
        .delete(shippingProfileVariant)
        .where(inArray(shippingProfileVariant.variantId, variantIds))
        .returning({ variantId: shippingProfileVariant.variantId })
    : []
  const movedProducts = new Set(fromProducts.map((r) => r.productId))
  if (fromVariants.length) {
    const owners = await tx
      .select({ productId: variant.productId })
      .from(variant)
      .where(
        inArray(
          variant.id,
          fromVariants.map((r) => r.variantId),
        ),
      )
    for (const o of owners) movedProducts.add(o.productId)
  }
  return { moved: movedProducts.size }
}
