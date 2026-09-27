/**
 * Shopify's open-source Standard Product Taxonomy (MIT, https://github.com/Shopify/product-taxonomy),
 * vendored as `[id, name]` pairs by `scripts/trim-product-taxonomy.ts`. See THIRD_PARTY_NOTICES.md.
 * Ids are hierarchical (`aa-1-2` sits under `aa-1`), so the breadcrumb, parent and depth
 * are rebuilt here instead of being shipped.
 */
export type TaxonomyCategory = {
  id: string
  name: string
  /** Full breadcrumb, e.g. "Apparel & Accessories > Clothing > Shirts". */
  path: string
  parentId: string | null
  level: number
}

export type TaxonomyRow = readonly [id: string, name: string]

let cached: Promise<TaxonomyCategory[]> | null = null

/** Parent of a hierarchical id: `aa-1-2` -> `aa-1`, `aa` -> null. */
export function parentIdOf(id: string): string | null {
  const cut = id.lastIndexOf('-')
  return cut === -1 ? null : id.slice(0, cut)
}

/** Rebuilds breadcrumbs from the trimmed rows. Rows arrive parents first, as upstream lists them. */
export function expandTaxonomy(rows: readonly TaxonomyRow[]): TaxonomyCategory[] {
  const byId = new Map<string, TaxonomyCategory>()
  const out: TaxonomyCategory[] = []
  for (const [id, name] of rows) {
    const parentId = parentIdOf(id)
    const parent = parentId ? byId.get(parentId) : undefined
    const category: TaxonomyCategory = {
      id,
      name,
      path: parent ? `${parent.path} > ${name}` : name,
      parentId,
      level: parent ? parent.level + 1 : 0,
    }
    byId.set(id, category)
    out.push(category)
  }
  return out
}

/** Lazily fetches the vendored taxonomy (its own chunk); only downloaded once the picker is used. */
export function loadTaxonomy(): Promise<TaxonomyCategory[]> {
  cached ??= import('@/data/product-taxonomy.json')
    .then((mod) => expandTaxonomy(mod.default as unknown as TaxonomyRow[]))
    .catch((err: unknown) => {
      cached = null
      throw err
    })
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
