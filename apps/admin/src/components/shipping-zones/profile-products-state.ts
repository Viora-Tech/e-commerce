import type { ProfileProductEntry } from '@commerce/core'

/**
 * A profile's products as the page edits them: each product with the variants ticked for this
 * profile. Saving turns the ticks into whole products and single variants (`toPlacement`).
 */
export type ProfileProductRow = ProfileProductEntry & { ticked: string[] }

/** Variants a whole product here would take: those that ship and are not placed alone elsewhere. */
const followers = (row: ProfileProductEntry) =>
  row.variants.filter((v) => v.requiresShipping && !v.placedElsewhere)

/** Variants the merchant can tick: those that ship (a service or download has no profile). */
export const tickable = (row: ProfileProductEntry) => row.variants.filter((v) => v.requiresShipping)

/** The rows as the server sent them: ticked where the variant ships under this profile now. */
export const rowsFrom = (entries: readonly ProfileProductEntry[]): ProfileProductRow[] =>
  entries.map((e) => ({ ...e, ticked: e.variants.filter((v) => v.inProfile).map((v) => v.id) }))

/**
 * What saving writes. A product with every variant that would follow it ticked goes in whole,
 * so variants added later join it (Shopify's "all variants"); ticked variants placed alone in
 * another profile come along as single variants, since they would not follow the product.
 * Otherwise only the ticked variants go in, one by one.
 */
export function toPlacement(rows: readonly ProfileProductRow[]): {
  productIds: string[]
  variantIds: string[]
} {
  const productIds: string[] = []
  const variantIds: string[] = []
  for (const row of rows) {
    const ticked = new Set(row.ticked.filter((id) => tickable(row).some((v) => v.id === id)))
    if (ticked.size === 0) continue
    const follow = followers(row)
    const whole = follow.length > 0 && follow.every((v) => ticked.has(v.id))
    if (whole) {
      productIds.push(row.productId)
      variantIds.push(
        ...row.variants.filter((v) => v.placedElsewhere && ticked.has(v.id)).map((v) => v.id),
      )
    } else {
      variantIds.push(...ticked)
    }
  }
  return { productIds, variantIds }
}

/**
 * Rows after products are added: new products come in with the picked variants ticked
 * (`picked` maps a product to them; missing means every variant that would follow the
 * product), and products already listed gain the picked ones.
 */
export function addRows(
  rows: readonly ProfileProductRow[],
  fresh: readonly ProfileProductEntry[],
  picked: ReadonlyMap<string, readonly string[]>,
): ProfileProductRow[] {
  const pickedFor = (e: ProfileProductEntry) =>
    picked.get(e.productId) ?? followers(e).map((v) => v.id)
  const next = rows.map((r) => {
    const add = fresh.find((e) => e.productId === r.productId)
    return add ? { ...r, ticked: [...new Set([...r.ticked, ...pickedFor(add)])] } : r
  })
  for (const e of fresh) {
    if (next.some((r) => r.productId === e.productId)) continue
    next.push({ ...e, ticked: [...pickedFor(e)] })
  }
  return next
}

/** Tick or untick one variant of a product. */
export const tickVariant = (
  rows: readonly ProfileProductRow[],
  productId: string,
  variantId: string,
  on: boolean,
): ProfileProductRow[] =>
  rows.map((r) =>
    r.productId !== productId
      ? r
      : {
          ...r,
          ticked: on
            ? [...new Set([...r.ticked, variantId])]
            : r.ticked.filter((id) => id !== variantId),
        },
  )
