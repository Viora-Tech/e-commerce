/**
 * Regenerates `apps/admin/src/data/product-taxonomy.json` from Shopify's open-source
 * Standard Product Taxonomy (MIT, https://github.com/Shopify/product-taxonomy; credited in
 * THIRD_PARTY_NOTICES.md). Keeps only `[id, name]` pairs: the breadcrumb, parent and depth
 * are all derivable from the hierarchical id (`aa-1-2` sits under `aa-1`), so the admin
 * rebuilds them at load time (`apps/admin/src/lib/product-taxonomy.ts`).
 *
 *   bun scripts/trim-product-taxonomy.ts            # pinned release below
 *   bun scripts/trim-product-taxonomy.ts v2026-11   # another release tag
 */

const release = process.argv[2] ?? 'v2026-08'
const url = `https://raw.githubusercontent.com/Shopify/product-taxonomy/${release}/dist/en/categories.txt`
const out = new URL('../apps/admin/src/data/product-taxonomy.json', import.meta.url)

const res = await fetch(url)
if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)

// Each line: "gid://shopify/TaxonomyCategory/aa-1-2   : Apparel & Accessories > Clothing > Shirts"
const rows: [string, string][] = []
for (const line of (await res.text()).split('\n')) {
  const match = line.match(/^gid:\/\/shopify\/TaxonomyCategory\/(\S+)\s*:\s*(.+)$/)
  if (!match) continue
  const [, id, path] = match as unknown as [string, string, string]
  const name = path.split(' > ').at(-1)?.trim()
  if (name) rows.push([id, name])
}
if (rows.length < 1000) throw new Error(`only ${rows.length} categories parsed; format changed?`)

await Bun.write(out, `${JSON.stringify(rows)}\n`)
console.log(`${rows.length} categories from ${release} -> ${out.pathname}`)
