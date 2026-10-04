/** SOURCE OF TRUTH: content field references — WHAT the existence check for every reference a field can hold (files, products, variants, collections, pages, blog posts, entries) and the admin picker rows for each kind / WHY a saved id must point at a record of this store, and the picker must offer exactly the records a field accepts. Runs under RLS on the caller's StoreTx. */
import {
  article,
  blog,
  collection,
  media,
  metaobject,
  metaobjectDefinition,
  page,
  product,
  type StoreTx,
  variant,
} from '@commerce/db'
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import type { ReferenceType } from './schemas'
import { entryDisplayName, type ReferenceUse } from './validate'

/** The table holding each plain reference type's records (metaobjects are checked apart). */
const TABLE = {
  file: media,
  product_reference: product,
  collection_reference: collection,
  page_reference: page,
  variant_reference: variant,
  article_reference: article,
} as const

const MISSING: Partial<Record<ReferenceType, string>> = {
  file: 'uses a file that was deleted. Pick another file',
}

/**
 * Confirm every referenced id exists in this store (RLS hides other stores'
 * rows, so a foreign id reads as missing) and that metaobject references point
 * into the right definition. Returns per-source errors.
 */
export async function referenceProblems(
  tx: StoreTx,
  uses: ReferenceUse[],
): Promise<Record<string, string>> {
  const problems: Record<string, string> = {}
  const idsOf = (type: ReferenceType) => [
    ...new Set(uses.filter((u) => u.type === type).map((u) => u.id)),
  ]
  const found = new Map<ReferenceType, Set<string>>()
  await Promise.all(
    (Object.keys(TABLE) as (keyof typeof TABLE)[]).map(async (type) => {
      const ids = idsOf(type)
      const table = TABLE[type]
      const rows = ids.length
        ? await tx.select({ id: table.id }).from(table).where(inArray(table.id, ids))
        : []
      found.set(type, new Set(rows.map((r) => r.id)))
    }),
  )
  const entryIds = idsOf('metaobject_reference')
  const entries = entryIds.length
    ? await tx
        .select({ id: metaobject.id, definitionId: metaobject.definitionId })
        .from(metaobject)
        .where(inArray(metaobject.id, entryIds))
    : []
  const entryDefinition = new Map(entries.map((r) => [r.id, r.definitionId]))
  for (const use of uses) {
    if (problems[use.source]) continue
    if (use.type === 'metaobject_reference') {
      const def = entryDefinition.get(use.id)
      if (!def) problems[use.source] = 'links to an entry that was deleted. Pick another one'
      else if (use.definitionId && def !== use.definitionId) {
        problems[use.source] =
          'links to an entry of a different content type. Pick one from the list'
      }
    } else if (!found.get(use.type)?.has(use.id)) {
      problems[use.source] =
        MISSING[use.type] ?? 'links to something that was deleted. Pick another one'
    }
  }
  return problems
}

export type ReferenceOption = {
  id: string
  label: string
  detail: string | null
  imageUrl: string | null
}

/** What a reference picker can search. */
export const REFERENCE_KINDS = [
  'product',
  'collection',
  'metaobject',
  'file',
  'page',
  'variant',
  'article',
] as const
export type ReferenceKind = (typeof REFERENCE_KINDS)[number]

type OptionsInput = {
  kind: ReferenceKind
  query?: string | undefined
  ids?: string[] | undefined
  definitionId?: string | undefined
  limit?: number | undefined
}

/** Picker rows for a reference field: by search text, or the labels of chosen ids. */
export async function referenceOptions(
  tx: StoreTx,
  input: OptionsInput,
): Promise<ReferenceOption[]> {
  if (input.ids && input.ids.length === 0) return []
  const limit = input.ids ? input.ids.length : (input.limit ?? 20)
  const q = input.query?.trim()
  switch (input.kind) {
    case 'product':
      return productOptions(tx, input.ids, q, limit)
    case 'variant':
      return variantOptions(tx, input.ids, q, limit)
    case 'file':
      return fileOptions(tx, input.ids, q, limit)
    case 'collection':
      return collectionOptions(tx, input.ids, q, limit)
    case 'page':
      return pageOptions(tx, input.ids, q, limit)
    case 'article':
      return articleOptions(tx, input.ids, q, limit)
    case 'metaobject':
      return entryOptions(tx, input, q, limit)
  }
}

type Ids = string[] | undefined

async function productOptions(tx: StoreTx, ids: Ids, q: string | undefined, limit: number) {
  const rows = await tx
    .select({
      id: product.id,
      title: product.title,
      handle: product.handle,
      status: product.status,
    })
    .from(product)
    .where(
      ids
        ? inArray(product.id, ids)
        : q
          ? or(ilike(product.title, `%${q}%`), ilike(product.handle, `%${q}%`))
          : undefined,
    )
    .orderBy(asc(product.title))
    .limit(limit)
  const images = await firstProductImages(
    tx,
    rows.map((r) => r.id),
  )
  return rows.map((r) => ({
    id: r.id,
    label: r.title,
    detail: r.status === 'active' ? r.handle : `${r.handle} (${r.status})`,
    imageUrl: images.get(r.id) ?? null,
  }))
}

/** Variants by product title, variant title or SKU, named "Product · Variant". */
async function variantOptions(tx: StoreTx, ids: Ids, q: string | undefined, limit: number) {
  const rows = await tx
    .select({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      productId: product.id,
      productTitle: product.title,
    })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(
      and(
        ids ? inArray(variant.id, ids) : isNull(variant.archivedAt),
        !ids && q
          ? or(
              ilike(product.title, `%${q}%`),
              ilike(variant.title, `%${q}%`),
              ilike(variant.sku, `%${q}%`),
            )
          : undefined,
      ),
    )
    .orderBy(asc(product.title), asc(variant.position))
    .limit(limit)
  const images = await firstProductImages(tx, [...new Set(rows.map((r) => r.productId))])
  return rows.map((r) => ({
    id: r.id,
    label: `${r.productTitle} · ${r.title}`,
    detail: r.sku,
    imageUrl: images.get(r.productId) ?? null,
  }))
}

async function fileOptions(tx: StoreTx, ids: Ids, q: string | undefined, limit: number) {
  const rows = await tx
    .select({ id: media.id, url: media.url, alt: media.alt, contentType: media.contentType })
    .from(media)
    .where(
      and(
        eq(media.status, 'ready'),
        ids ? inArray(media.id, ids) : q ? ilike(media.alt, `%${q}%`) : undefined,
      ),
    )
    .orderBy(desc(media.createdAt))
    .limit(limit)
  return rows.map((r) => ({
    id: r.id,
    label: r.alt || (r.url.split('/').pop() ?? r.url),
    detail: r.contentType,
    imageUrl: r.contentType?.startsWith('image/') || !r.contentType ? r.url : null,
  }))
}

async function collectionOptions(tx: StoreTx, ids: Ids, q: string | undefined, limit: number) {
  const rows = await tx
    .select({
      id: collection.id,
      title: collection.title,
      handle: collection.handle,
      url: media.url,
    })
    .from(collection)
    .leftJoin(media, eq(media.id, collection.imageMediaId))
    .where(ids ? inArray(collection.id, ids) : q ? ilike(collection.title, `%${q}%`) : undefined)
    .orderBy(asc(collection.title))
    .limit(limit)
  return rows.map((r) => ({ id: r.id, label: r.title, detail: r.handle, imageUrl: r.url }))
}

async function pageOptions(tx: StoreTx, ids: Ids, q: string | undefined, limit: number) {
  const rows = await tx
    .select({ id: page.id, title: page.title, handle: page.handle })
    .from(page)
    .where(
      ids
        ? inArray(page.id, ids)
        : q
          ? or(ilike(page.title, `%${q}%`), ilike(page.handle, `%${q}%`))
          : undefined,
    )
    .orderBy(asc(page.title))
    .limit(limit)
  return rows.map((r) => ({
    id: r.id,
    label: r.title,
    detail: `/pages/${r.handle}`,
    imageUrl: null,
  }))
}

async function articleOptions(tx: StoreTx, ids: Ids, q: string | undefined, limit: number) {
  const rows = await tx
    .select({ id: article.id, title: article.title, blogTitle: blog.title, url: media.url })
    .from(article)
    .innerJoin(blog, eq(blog.id, article.blogId))
    .leftJoin(media, eq(media.id, article.imageMediaId))
    .where(ids ? inArray(article.id, ids) : q ? ilike(article.title, `%${q}%`) : undefined)
    .orderBy(desc(article.updatedAt))
    .limit(limit)
  return rows.map((r) => ({ id: r.id, label: r.title, detail: r.blogTitle, imageUrl: r.url }))
}

async function entryOptions(
  tx: StoreTx,
  input: OptionsInput,
  q: string | undefined,
  limit: number,
) {
  const rows = await tx
    .select({
      id: metaobject.id,
      handle: metaobject.handle,
      fields: metaobject.fields,
      displayNameKey: metaobjectDefinition.displayNameKey,
      name: metaobjectDefinition.name,
    })
    .from(metaobject)
    .innerJoin(metaobjectDefinition, eq(metaobjectDefinition.id, metaobject.definitionId))
    .where(
      and(
        input.ids ? inArray(metaobject.id, input.ids) : undefined,
        input.definitionId ? eq(metaobject.definitionId, input.definitionId) : undefined,
        !input.ids && q
          ? or(
              ilike(metaobject.handle, `%${q}%`),
              sql`${metaobject.fields}::text ilike ${`%${q}%`}`,
            )
          : undefined,
      ),
    )
    .orderBy(desc(metaobject.updatedAt))
    .limit(limit)
  return rows.map((r) => ({
    id: r.id,
    label: entryDisplayName(r.displayNameKey, r.fields, r.handle),
    detail: r.name,
    imageUrl: null,
  }))
}

async function firstProductImages(tx: StoreTx, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const rows = await tx.execute<{ product_id: string; url: string }>(sql`
    select distinct on (pm.product_id) pm.product_id, m.url
    from product_media pm join media m on m.id = pm.media_id
    where pm.product_id in (${sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
    order by pm.product_id, pm.position`)
  return new Map(rows.map((r) => [r.product_id, r.url]))
}
