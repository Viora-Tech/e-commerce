/** SOURCE OF TRUTH: a shipping profile's product list — WHAT: each product with its variants, which ship under the profile and where the rest ship / WHY: the admin profile page and the API read the same shape */
import { media, product, productMedia, type StoreTx, shippingProfile, variant } from '@commerce/db'
import { and, asc, inArray, isNull, sql } from 'drizzle-orm'
import { productProfiles, variantProfiles } from './profile-placement'
import { lineProfileId } from './profiles'
import { GENERAL_PROFILE_NAME } from './rates-service'

/** One variant of a product on a profile's page. */
export type ProfileEntryVariant = {
  id: string
  title: string
  sku: string | null
  /** Ships under this profile now. */
  inProfile: boolean
  /** Where it ships now when not here (General included); null when here. */
  shipsUnder: { id: string; name: string } | null
  /** Placed in another profile on its own, so a whole product here does not take it. */
  placedElsewhere: boolean
  /** "Requires shipping" off: no profile prices it. */
  requiresShipping: boolean
}

/** A product on a profile's page, with which of its variants are in the profile. */
export type ProfileProductEntry = {
  productId: string
  title: string
  imageUrl: string | null
  /** The product itself is in the profile (every variant, including ones added later). */
  whole: boolean
  variants: ProfileEntryVariant[]
}

/**
 * The products as a profile's page lists them: each with its live variants, which of them ship
 * under `profileId` and where the others ship now. `profileId` null reads them for a profile
 * not saved yet.
 */
export async function profileProductEntries(
  tx: StoreTx,
  profileId: string | null,
  productIds: readonly string[],
): Promise<ProfileProductEntry[]> {
  const ids = [...new Set(productIds)]
  if (ids.length === 0) return []
  const products = await tx
    .select({
      id: product.id,
      title: product.title,
      imageUrl: sql<string | null>`(
        select m.url from ${productMedia} pm join ${media} m on m.id = pm.media_id
        where pm.product_id = "product"."id" order by pm.position limit 1)`,
    })
    .from(product)
    .where(inArray(product.id, ids))
    .orderBy(asc(product.title))
  const variants = await tx
    .select({
      id: variant.id,
      productId: variant.productId,
      title: variant.title,
      sku: variant.sku,
      requiresShipping: variant.requiresShipping,
    })
    .from(variant)
    .where(and(inArray(variant.productId, ids), isNull(variant.archivedAt)))
    .orderBy(asc(variant.position))
  const profiles = await tx
    .select({
      id: shippingProfile.id,
      name: shippingProfile.name,
      isDefault: shippingProfile.isDefault,
    })
    .from(shippingProfile)
  const general = profiles.find((p) => p.isDefault) ?? { id: '', name: GENERAL_PROFILE_NAME }
  const byProduct = await productProfiles(tx, ids)
  const byVariant = await variantProfiles(
    tx,
    variants.map((v) => v.id),
  )
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.name ?? general.name
  return products.map((p) => ({
    productId: p.id,
    title: p.title,
    imageUrl: p.imageUrl,
    whole: profileId !== null && byProduct.get(p.id) === profileId,
    variants: variants
      .filter((v) => v.productId === p.id)
      .map((v) => {
        const at = lineProfileId(
          { variantId: v.id, productId: p.id },
          byVariant,
          byProduct,
          general.id,
        )
        const own = byVariant.get(v.id)
        return {
          id: v.id,
          title: v.title,
          sku: v.sku,
          inProfile: profileId !== null && at === profileId,
          shipsUnder: at === profileId ? null : { id: at, name: nameOf(at) },
          placedElsewhere: own !== undefined && own !== profileId,
          requiresShipping: v.requiresShipping,
        }
      }),
  }))
}
