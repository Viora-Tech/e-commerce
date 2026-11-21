/** SOURCE OF TRUTH: the Product rules page's collection check — WHAT: collections named like a
 * collection a rule targets ("Glasspads" and "Glass pads") that the rule does not name, and how
 * many of their products the rule therefore misses / WHY: owner, 20 Nov 2026: Waimers has two
 * Glasspads collections and only one had a rule, so some glass pads shipped by any courier.
 * `collectionTwins` is pure; `loadCollectionTwins` reads the collections.
 */
import { collection, collectionProduct, type StoreTx } from '@commerce/db'
import type { RouteRule } from './config'

export type CollectionTwin = {
  ruleId: string
  ruleName: string
  /** The collection the rule names. */
  ruled: { id: string; title: string }
  /** A collection of the same name the rule does not name. */
  other: { id: string; title: string }
  /** Products in `other` and in none of the rule's collections. */
  missing: number
}

/** "Glass pads", "glasspads" and "Glasspad" read the same. */
export const twinKey = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-ॿ]/g, '')
    .replace(/s$/, '')

export function collectionTwins(
  rules: readonly Pick<RouteRule, 'id' | 'name' | 'target' | 'enabled'>[],
  collections: ReadonlyArray<{ id: string; title: string }>,
  members: ReadonlyMap<string, ReadonlySet<string>>,
): CollectionTwin[] {
  const out: CollectionTwin[] = []
  for (const rule of rules) {
    if (!rule.enabled || rule.target.kind !== 'collections') continue
    const named = new Set(rule.target.values)
    const covered = new Set(rule.target.values.flatMap((id) => [...(members.get(id) ?? [])]))
    for (const ruled of collections.filter((c) => named.has(c.id))) {
      const key = twinKey(ruled.title)
      for (const other of collections) {
        if (named.has(other.id) || twinKey(other.title) !== key) continue
        const missing = [...(members.get(other.id) ?? [])].filter((p) => !covered.has(p)).length
        if (missing === 0) continue
        out.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ruled: { id: ruled.id, title: ruled.title },
          other: { id: other.id, title: other.title },
          missing,
        })
      }
    }
  }
  return out
}

/** The store's collections and their products, checked against `rules`. RLS scopes the rows. */
export async function loadCollectionTwins(
  tx: StoreTx,
  rules: readonly RouteRule[],
): Promise<CollectionTwin[]> {
  if (!rules.some((r) => r.target.kind === 'collections')) return []
  const collections = await tx.select({ id: collection.id, title: collection.title }).from(collection)
  const rows = await tx
    .select({ c: collectionProduct.collectionId, p: collectionProduct.productId })
    .from(collectionProduct)
  const members = new Map<string, Set<string>>()
  for (const r of rows) {
    const set = members.get(r.c) ?? new Set<string>()
    set.add(r.p)
    members.set(r.c, set)
  }
  return collectionTwins(rules, collections, members)
}
