/**
 * The Orders "Product is …" filter's picks (Shopify's Product filter): whole products (every
 * variant) and single variants. A product with every variant ticked is kept as the product, so
 * the URL stays short and later variants count too. Pure, so the chip text and ticks are tested.
 */

export type ProductPick = { productIds: string[]; variantIds: string[] }

/** A product as the picker lists it: its id and its variants' ids, in order. */
export type PickProduct = { id: string; variantIds: readonly string[] }

export const NO_PICK: ProductPick = { productIds: [], variantIds: [] }

/** True when anything is picked. */
export function hasPick(pick: ProductPick): boolean {
  return pick.productIds.length > 0 || pick.variantIds.length > 0
}

/** The product's tick box: every variant counts ('all'), some do, or none. */
export function productState(pick: ProductPick, row: PickProduct): 'all' | 'some' | 'none' {
  if (pick.productIds.includes(row.id)) return 'all'
  return row.variantIds.some((v) => pick.variantIds.includes(v)) ? 'some' : 'none'
}

/** A variant's tick box: picked by itself, or through its whole product. */
export function variantPicked(pick: ProductPick, row: PickProduct, variantId: string): boolean {
  return pick.productIds.includes(row.id) || pick.variantIds.includes(variantId)
}

/** Ticks or unticks a whole product; its single variants fold into it either way. */
export function toggleProduct(pick: ProductPick, row: PickProduct, on: boolean): ProductPick {
  const variantIds = pick.variantIds.filter((v) => !row.variantIds.includes(v))
  const others = pick.productIds.filter((p) => p !== row.id)
  return { productIds: on ? [...others, row.id] : others, variantIds }
}

/**
 * Ticks or unticks one variant. Unticking one of a whole product leaves its other variants
 * ticked; ticking the last one left becomes the whole product.
 */
export function toggleVariant(
  pick: ProductPick,
  row: PickProduct,
  variantId: string,
  on: boolean,
): ProductPick {
  const whole = pick.productIds.includes(row.id)
  if (!on && whole) {
    return {
      productIds: pick.productIds.filter((p) => p !== row.id),
      variantIds: [
        ...pick.variantIds.filter((v) => !row.variantIds.includes(v)),
        ...row.variantIds.filter((v) => v !== variantId),
      ],
    }
  }
  if (on && whole) return pick
  const variantIds = on
    ? [...pick.variantIds.filter((v) => v !== variantId), variantId]
    : pick.variantIds.filter((v) => v !== variantId)
  const next = { productIds: pick.productIds, variantIds }
  const all = row.variantIds.length > 0 && row.variantIds.every((v) => variantIds.includes(v))
  return all ? toggleProduct(next, row, true) : next
}

/** Every pick, in the order the merchant made them: products first, then single variants. */
function pickedIds(pick: ProductPick): string[] {
  return [...pick.productIds, ...pick.variantIds]
}

type SummaryCopy = {
  /** "Hachiware ICE Glasspad, +2". */
  more: (first: string, n: number) => string
  /** While the names are still loading: "3 picked". */
  count: (n: number) => string
}

/**
 * The chip's value: the first pick's name, then how many more ("Hachiware ICE Glasspad, +2").
 * `names` maps product ids to titles and variant ids to "Title · Size". Null with no picks.
 */
export function pickSummary(
  pick: ProductPick,
  names: ReadonlyMap<string, string>,
  copy: SummaryCopy,
): string | null {
  const ids = pickedIds(pick)
  const first = ids[0]
  if (first === undefined) return null
  const name = names.get(first)
  if (name === undefined) return copy.count(ids.length)
  return ids.length > 1 ? copy.more(name, ids.length - 1) : name
}

/** The picks as one stable string, so a change of pick resets the table's row selection. */
export function pickSignature(pick: ProductPick, negated: boolean): string {
  return `${negated ? '!' : ''}${pick.productIds.join(',')}|${pick.variantIds.join(',')}`
}

/** The product and variant names one picker page adds, for the chip. */
export function namesFromRows(
  rows: readonly {
    id: string
    title: string
    variants: readonly { id: string; title: string }[]
  }[],
): [string, string][] {
  return rows.flatMap((r) => [
    [r.id, r.title] as [string, string],
    ...r.variants.map((v) => [v.id, `${r.title} · ${v.title}`] as [string, string]),
  ])
}
