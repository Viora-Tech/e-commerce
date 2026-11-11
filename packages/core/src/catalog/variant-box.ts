/** SOURCE OF TRUTH: a variant's own box versus the product's Package (#1517)
 * WHAT:  A product ships in one box (its Package, a named box or custom size); a variant may pick
 *        its own named box instead. The box in use is always stored on the variant
 *        (`box_preset_id` and the package dims), so booking, quotes and packing cost read the
 *        variant and nothing else. `box_own` says whether that box is the variant's own choice:
 *        the product's Package is written only onto variants without one.
 * WHY:   A keyboard sold in 60% and 80% sizes needs two boxes (owner, 11 Nov 2026).
 * WHERE: the product page (form-state, shipping card, variant page), the bulk sheet
 *        (bulk-edit.ts) and the products list's "Set weight and box" (bulk-shipping.ts).
 */

export type VariantBox = {
  boxPresetId: string | null
  packageLengthCm: number | null
  packageWidthCm: number | null
  packageHeightCm: number | null
}

const NO_VARIANT_BOX: VariantBox = {
  boxPresetId: null,
  packageLengthCm: null,
  packageWidthCm: null,
  packageHeightCm: null,
}

/** Just the box fields of a variant-like row. */
export function variantBox(v: {
  boxPresetId?: string | null | undefined
  packageLengthCm?: number | null | undefined
  packageWidthCm?: number | null | undefined
  packageHeightCm?: number | null | undefined
}): VariantBox {
  return {
    boxPresetId: v.boxPresetId ?? null,
    packageLengthCm: v.packageLengthCm ?? null,
    packageWidthCm: v.packageWidthCm ?? null,
    packageHeightCm: v.packageHeightCm ?? null,
  }
}

/** True when two rows pack in the same box (same named box and same custom size). */
function sameBox(a: Partial<VariantBox>, b: Partial<VariantBox>): boolean {
  const x = variantBox(a)
  const y = variantBox(b)
  return (
    x.boxPresetId === y.boxPresetId &&
    x.packageLengthCm === y.packageLengthCm &&
    x.packageWidthCm === y.packageWidthCm &&
    x.packageHeightCm === y.packageHeightCm
  )
}

/**
 * The product's Package: the box of its first variant (in order) that follows the product. When
 * every variant has its own box, the first variant's, so the picker still shows something real.
 */
export function productBoxOf<V extends Partial<VariantBox> & { boxOwn?: boolean | null }>(
  variants: readonly V[],
): VariantBox {
  const follower = variants.find((v) => !v.boxOwn) ?? variants[0]
  return follower ? variantBox(follower) : NO_VARIANT_BOX
}

export type SettleRow = VariantBox & {
  id: string
  boxOwn: boolean | null
  /** Its box was just changed by a tool that edits variants one by one (the bulk sheet). */
  edited: boolean
}

/**
 * After a per-variant box edit, which variants of ONE product (in order) now have their own box.
 * The product's Package is the box of a following variant that was not edited; when every
 * following variant was edited, the box most of the edited ones got. An edited variant whose box
 * matches it follows the product again; one that differs keeps its own. Returns only changes.
 */
export function settleBoxOwn(rows: readonly SettleRow[]): Map<string, boolean> {
  const reference = rows.find((r) => !r.boxOwn && !r.edited)
  let productBox: VariantBox | null = reference ? variantBox(reference) : null
  if (!productBox) {
    const counts: { box: VariantBox; n: number }[] = []
    for (const r of rows.filter((x) => x.edited)) {
      const hit = counts.find((c) => sameBox(c.box, r))
      if (hit) hit.n += 1
      else counts.push({ box: variantBox(r), n: 1 })
    }
    productBox =
      counts.reduce<{ box: VariantBox; n: number } | null>(
        (best, c) => (!best || c.n > best.n ? c : best),
        null,
      )?.box ?? null
  }
  const out = new Map<string, boolean>()
  if (!productBox) return out
  for (const r of rows) {
    if (!r.edited) continue
    const own = !sameBox(r, productBox)
    if (own !== Boolean(r.boxOwn)) out.set(r.id, own)
  }
  return out
}
