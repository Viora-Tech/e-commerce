/**
 * Shopify's open-source Standard Product Taxonomy (MIT), trimmed to just the
 * fields the category picker needs. See THIRD_PARTY_NOTICES.md.
 */
export type TaxonomyCategory = {
  id: string
  name: string
  /** Full breadcrumb, e.g. "Apparel & Accessories > Clothing > Shirts". */
  path: string
  parentId: string | null
  level: number
}

let cached: Promise<TaxonomyCategory[]> | null = null

/** Lazily fetches the vendored taxonomy JSON; only downloaded once the picker opens. */
export function loadTaxonomy(): Promise<TaxonomyCategory[]> {
  cached ??= import('@/data/product-taxonomy.json').then(
    (mod) => (mod.default ?? mod) as TaxonomyCategory[],
  )
  return cached
}

/** Pure so it's unit-testable without the dynamic import. */
export function searchCategories(
  categories: TaxonomyCategory[],
  query: string,
  limit = 20,
): TaxonomyCategory[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const scored = categories
    .map((c) => ({ category: c, score: matchScore(c, q) }))
    .filter((r) => r.score > 0)
  scored.sort((a, b) => b.score - a.score || a.category.path.length - b.category.path.length)
  return scored.slice(0, limit).map((r) => r.category)
}

function matchScore(c: TaxonomyCategory, q: string): number {
  const name = c.name.toLowerCase()
  const path = c.path.toLowerCase()
  if (name === q) return 100
  if (name.startsWith(q)) return 80
  if (name.includes(q)) return 60
  if (path.includes(q)) return 40
  return 0
}

/** Category by id, for showing the picked category's label without a search. */
export function findCategory(
  categories: TaxonomyCategory[],
  id: string | null | undefined,
): TaxonomyCategory | null {
  if (!id) return null
  return categories.find((c) => c.id === id) ?? null
}
