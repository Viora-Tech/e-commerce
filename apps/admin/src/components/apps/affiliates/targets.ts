/**
 * Rows of an affiliate program that name a product or a collection (commission rates, products
 * that earn nothing, the code's products): picked in the Browse dialog, which hands back ids
 * only. Pure, so the merge is tested without a browser.
 */

export type TargetKind = 'product' | 'collection'

type Targeted = { target: TargetKind; id: string }

/** The Browse dialog's tab for a kind. */
export const tabOf = (kind: TargetKind): 'products' | 'collections' =>
  kind === 'product' ? 'products' : 'collections'

/** The ids of one kind, in their saved order. */
export function idsOf(rows: readonly Targeted[], kind: TargetKind): string[] {
  return rows.filter((r) => r.target === kind).map((r) => r.id)
}

/**
 * One kind's rows after a pick: rows still picked keep their settings (rate, label), new ids
 * get `make(id)`, unpicked ones go. Rows of the other kind stay as they are, first.
 */
export function withPicked<T extends Targeted>(
  rows: readonly T[],
  kind: TargetKind,
  ids: readonly string[],
  make: (id: string) => T,
): T[] {
  const others = rows.filter((r) => r.target !== kind)
  const mine = new Map(rows.filter((r) => r.target === kind).map((r) => [r.id, r]))
  const unique = [...new Set(ids)]
  return [...others, ...unique.map((id) => mine.get(id) ?? make(id))]
}

/** One row of a kind changed in place (its rate typed in). */
export function patchRow<T extends Targeted>(
  rows: readonly T[],
  kind: TargetKind,
  id: string,
  patch: Partial<T>,
): T[] {
  return rows.map((r) => (r.target === kind && r.id === id ? { ...r, ...patch } : r))
}

/** A percent typed in a row (`12.5`) as basis points, clamped to 0..100%. */
export function percentToBp(typed: string, min = 0): number {
  const n = Number(typed)
  if (!Number.isFinite(n)) return min
  return Math.min(10_000, Math.max(min, Math.round(n * 100)))
}
