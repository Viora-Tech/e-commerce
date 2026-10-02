/**
 * Resolve the Shopify ids a metafield or entry links to into our ids: products,
 * collections and entries through the import mapping, files through the
 * mapping or, failing that, by copying the file now. Every answer is cached
 * for the run, and a mapping whose row was deleted since counts as missing.
 */
import { collection, media, metaobject, product } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { fetchFile } from './api-files'
import type { PendingReference } from './field-values'
import { errorMessage, findMapping, type ImportContext } from './runtime'
import type { ShopifyClient } from './shopify-client'
import { hostShopifyFile } from './write-files'

const RESOURCE = {
  product_reference: 'products',
  collection_reference: 'collections',
  metaobject_reference: 'metaobjects',
  file: 'files',
} as const

const TABLE = {
  product_reference: product,
  collection_reference: collection,
  metaobject_reference: metaobject,
  file: media,
} as const

export type ReferenceResolver = {
  resolve(ref: PendingReference): Promise<string | null>
  /** Forget cached misses, so a second pass sees entries written since. */
  retryMisses(): void
}

export function createReferenceResolver(
  ctx: ImportContext,
  client: ShopifyClient | null,
): ReferenceResolver {
  const cache = new Map<string, Promise<string | null>>()

  const mapped = (ref: PendingReference) =>
    ctx.inStore(async (tx) => {
      const id = await findMapping(tx, RESOURCE[ref.kind], ref.gid)
      if (!id) return null
      const table = TABLE[ref.kind]
      const [row] = await tx.select({ id: table.id }).from(table).where(eq(table.id, id))
      return row?.id ?? null
    })

  const lookup = async (ref: PendingReference): Promise<string | null> => {
    const id = await mapped(ref)
    if (id || ref.kind !== 'file' || !client || ctx.dryRun) return id
    try {
      const file = await fetchFile(client, ref.gid)
      if (!file) return null
      const hosted = await hostShopifyFile(ctx, file)
      return hosted.ok ? hosted.mediaId : null
    } catch (err) {
      ctx.log(`linked file ${ref.gid} not copied: ${errorMessage(err)}`)
      return null
    }
  }

  const misses = new Set<string>()

  return {
    resolve(ref) {
      const key = `${ref.kind}:${ref.gid}`
      let hit = cache.get(key)
      if (!hit) {
        hit = lookup(ref).then((id) => {
          if (!id) misses.add(key)
          return id
        })
        cache.set(key, hit)
      }
      return hit
    },
    retryMisses() {
      for (const key of misses) cache.delete(key)
      misses.clear()
    },
  }
}
