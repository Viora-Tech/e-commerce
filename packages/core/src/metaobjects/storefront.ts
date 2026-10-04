import {
  article,
  blog,
  collection,
  media,
  metafield,
  metafieldDefinition,
  metaobject,
  metaobjectDefinition,
  page,
  product,
  variant,
} from '@commerce/db'
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { visibleNow } from '../blog/service'
import type { StoreContext } from '../context'
import type { FieldType, FieldValidations, MetafieldOwnerType } from './schemas'

/**
 * Storefront data layer for custom data. Only definitions with storefront
 * access and active entries are served. References resolve one level deep, so
 * templates get `{ handle, title }` for a product rather than its id, and a
 * metaobject reference carries its own raw fields (not resolved again). Files
 * picked in a group's rows resolve too; a hidden or deleted target drops out.
 */

type Ctx = Pick<StoreContext, 'tx'>

export type ResolvedProduct = { id: string; handle: string; title: string }
export type ResolvedCollection = { id: string; handle: string; title: string }
export type ResolvedFile = { id: string; url: string; alt: string | null }
export type ResolvedPage = { id: string; handle: string; title: string }
/** A blog post: its own handle and its blog's, for `/blogs/<blogHandle>/<handle>`. */
export type ResolvedArticle = { id: string; handle: string; title: string; blogHandle: string }
/** A variant with its product, for `/products/<productHandle>?variant=<id>`. */
export type ResolvedVariant = {
  id: string
  title: string
  sku: string | null
  price: number
  productHandle: string
  productTitle: string
}
export type ResolvedMetaobjectRef = {
  id: string
  handle: string
  type: string
  fields: Record<string, unknown>
}

export type StorefrontMetaobject = {
  id: string
  handle: string
  type: string
  /** Field key to resolved value; lists stay lists, missing references drop out. */
  fields: Record<string, unknown>
  updatedAt: Date
}

/** What a field needs to resolve its value. */
type FieldShape = { type: FieldType; validations?: FieldValidations | undefined }

const REF_KIND = {
  file: 'file',
  product_reference: 'product',
  collection_reference: 'collection',
  metaobject_reference: 'metaobject',
  page_reference: 'page',
  variant_reference: 'variant',
  article_reference: 'article',
} as const satisfies Partial<Record<FieldType, string>>
type RefKind = (typeof REF_KIND)[keyof typeof REF_KIND]

type Refs = Record<RefKind, Set<string>>

type Loaded = {
  file: Map<string, ResolvedFile>
  product: Map<string, ResolvedProduct>
  collection: Map<string, ResolvedCollection>
  metaobject: Map<string, ResolvedMetaobjectRef>
  page: Map<string, ResolvedPage>
  variant: Map<string, ResolvedVariant>
  article: Map<string, ResolvedArticle>
}

const refKind = (type: FieldType): RefKind | undefined =>
  (REF_KIND as Partial<Record<FieldType, RefKind>>)[type]

const emptyRefs = (): Refs => ({
  file: new Set(),
  product: new Set(),
  collection: new Set(),
  metaobject: new Set(),
  page: new Set(),
  variant: new Set(),
  article: new Set(),
})

/** Group rows' file fields, by key. */
const rowFileKeys = (field: FieldShape): string[] =>
  (field.validations?.subfields ?? []).filter((s) => s.type === 'file').map((s) => s.key)

const asRows = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    : []

function gather(refs: Refs, field: FieldShape, value: unknown) {
  if (field.type === 'group') {
    const keys = rowFileKeys(field)
    for (const row of asRows(value)) {
      for (const key of keys) if (typeof row[key] === 'string') refs.file.add(row[key])
    }
    return
  }
  const kind = refKind(field.type)
  if (!kind) return
  for (const v of Array.isArray(value) ? value : [value]) {
    if (typeof v === 'string') refs[kind].add(v)
  }
}

async function load(ctx: Ctx, refs: Refs): Promise<Loaded> {
  const ids = (s: Set<string>) => [...s]
  const [files, products, collections, entries, pages, variants, articles] = await Promise.all([
    refs.file.size
      ? ctx.tx
          .select({ id: media.id, url: media.url, alt: media.alt })
          .from(media)
          .where(inArray(media.id, ids(refs.file)))
      : [],
    refs.product.size
      ? ctx.tx
          .select({ id: product.id, handle: product.handle, title: product.title })
          .from(product)
          .where(and(inArray(product.id, ids(refs.product)), eq(product.status, 'active')))
      : [],
    refs.collection.size
      ? ctx.tx
          .select({ id: collection.id, handle: collection.handle, title: collection.title })
          .from(collection)
          .where(and(inArray(collection.id, ids(refs.collection)), eq(collection.status, 'active')))
      : [],
    refs.metaobject.size
      ? ctx.tx
          .select({
            id: metaobject.id,
            handle: metaobject.handle,
            type: metaobjectDefinition.type,
            fields: metaobject.fields,
          })
          .from(metaobject)
          .innerJoin(metaobjectDefinition, eq(metaobjectDefinition.id, metaobject.definitionId))
          .where(
            and(
              inArray(metaobject.id, ids(refs.metaobject)),
              eq(metaobject.status, 'active'),
              eq(metaobjectDefinition.storefrontAccess, true),
            ),
          )
      : [],
    refs.page.size
      ? ctx.tx
          .select({ id: page.id, handle: page.handle, title: page.title })
          .from(page)
          .where(and(inArray(page.id, ids(refs.page)), isNotNull(page.publishedAt)))
      : [],
    refs.variant.size
      ? ctx.tx
          .select({
            id: variant.id,
            title: variant.title,
            sku: variant.sku,
            price: variant.pricePaise,
            productHandle: product.handle,
            productTitle: product.title,
          })
          .from(variant)
          .innerJoin(product, eq(product.id, variant.productId))
          .where(
            and(
              inArray(variant.id, ids(refs.variant)),
              isNull(variant.archivedAt),
              eq(product.status, 'active'),
            ),
          )
      : [],
    refs.article.size
      ? ctx.tx
          .select({
            id: article.id,
            handle: article.handle,
            title: article.title,
            blogHandle: blog.handle,
          })
          .from(article)
          .innerJoin(blog, eq(blog.id, article.blogId))
          .where(and(inArray(article.id, ids(refs.article)), visibleNow(new Date())))
      : [],
  ])
  return {
    file: new Map(files.map((r) => [r.id, r])),
    product: new Map(products.map((r) => [r.id, r])),
    collection: new Map(collections.map((r) => [r.id, r])),
    metaobject: new Map(entries.map((r) => [r.id, r])),
    page: new Map(pages.map((r) => [r.id, r])),
    variant: new Map(variants.map((r) => [r.id, r])),
    article: new Map(articles.map((r) => [r.id, r])),
  }
}

/** Swap reference ids for loaded records; a missing or hidden target drops out. */
function resolveValue(field: FieldShape, value: unknown, loaded: Loaded): unknown {
  if (field.type === 'group') {
    const keys = rowFileKeys(field)
    return asRows(value).map((row) => {
      const out = { ...row }
      for (const key of keys) {
        if (key in out)
          out[key] = typeof out[key] === 'string' ? (loaded.file.get(out[key]) ?? null) : null
      }
      return out
    })
  }
  const kind = refKind(field.type)
  if (!kind) return value
  const map = loaded[kind] as Map<string, unknown>
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'string' ? map.get(v) : undefined)).filter(Boolean)
  }
  return typeof value === 'string' ? (map.get(value) ?? null) : null
}

async function resolveEntries(
  ctx: Ctx,
  def: { type: string; fields: ({ key: string } & FieldShape)[] },
  rows: { id: string; handle: string; fields: Record<string, unknown>; updatedAt: Date }[],
): Promise<StorefrontMetaobject[]> {
  const refs = emptyRefs()
  for (const row of rows) {
    for (const f of def.fields) gather(refs, f, row.fields[f.key])
  }
  const loaded = await load(ctx, refs)
  return rows.map((row) => {
    const fields: Record<string, unknown> = {}
    for (const f of def.fields) {
      const v = row.fields[f.key]
      fields[f.key] = v === undefined ? null : resolveValue(f, v, loaded)
    }
    return { id: row.id, handle: row.handle, type: def.type, fields, updatedAt: row.updatedAt }
  })
}

async function visibleDefinition(ctx: Ctx, type: string) {
  const [def] = await ctx.tx
    .select()
    .from(metaobjectDefinition)
    .where(
      and(eq(metaobjectDefinition.type, type), eq(metaobjectDefinition.storefrontAccess, true)),
    )
  return def ?? null
}

/** Active entries of one metaobject type, newest first. Empty when the type is hidden or unknown. */
export async function metaobjectsByType(
  ctx: Ctx,
  type: string,
  opts: { limit?: number | undefined } = {},
): Promise<StorefrontMetaobject[]> {
  const def = await visibleDefinition(ctx, type)
  if (!def) return []
  const rows = await ctx.tx
    .select({
      id: metaobject.id,
      handle: metaobject.handle,
      fields: metaobject.fields,
      updatedAt: metaobject.updatedAt,
    })
    .from(metaobject)
    .where(and(eq(metaobject.definitionId, def.id), eq(metaobject.status, 'active')))
    .orderBy(asc(metaobject.createdAt))
    .limit(Math.min(opts.limit ?? 50, 250))
  return resolveEntries(ctx, def as Parameters<typeof resolveEntries>[1], rows)
}

/** One active entry by type and handle, or null. */
export async function metaobjectByHandle(
  ctx: Ctx,
  type: string,
  handle: string,
): Promise<StorefrontMetaobject | null> {
  const def = await visibleDefinition(ctx, type)
  if (!def) return null
  const rows = await ctx.tx
    .select({
      id: metaobject.id,
      handle: metaobject.handle,
      fields: metaobject.fields,
      updatedAt: metaobject.updatedAt,
    })
    .from(metaobject)
    .where(
      and(
        eq(metaobject.definitionId, def.id),
        eq(metaobject.handle, handle),
        eq(metaobject.status, 'active'),
      ),
    )
  const [entry] = await resolveEntries(ctx, def as Parameters<typeof resolveEntries>[1], rows)
  return entry ?? null
}

/** One resolved metafield with its definition's type (dynamic sources coerce by type). */
export type TypedMetafield = { namespace: string; key: string; type: FieldType; value: unknown }

/** A product's or collection's storefront-visible metafields, references resolved. */
export async function typedMetafieldsFor(
  ctx: Ctx,
  ownerType: MetafieldOwnerType,
  ownerId: string,
): Promise<TypedMetafield[]> {
  const rows = await ctx.tx
    .select({
      namespace: metafieldDefinition.namespace,
      key: metafieldDefinition.key,
      type: metafieldDefinition.type,
      validations: metafieldDefinition.validations,
      value: metafield.value,
    })
    .from(metafield)
    .innerJoin(metafieldDefinition, eq(metafieldDefinition.id, metafield.definitionId))
    .where(
      and(
        eq(metafield.ownerType, ownerType),
        eq(metafield.ownerId, ownerId),
        eq(metafieldDefinition.storefrontAccess, true),
      ),
    )
  const shape = (r: (typeof rows)[number]): FieldShape => ({
    type: r.type,
    validations: r.validations as FieldValidations,
  })
  const refs = emptyRefs()
  for (const r of rows) gather(refs, shape(r), r.value)
  const loaded = await load(ctx, refs)
  return rows.map((r) => ({
    namespace: r.namespace,
    key: r.key,
    type: r.type,
    value: resolveValue(shape(r), r.value, loaded),
  }))
}

/**
 * A product's or collection's metafields as `namespace → key → value`, the
 * shape templates read (`product.metafields.custom.size_guide`).
 */
export async function metafieldsFor(
  ctx: Ctx,
  ownerType: MetafieldOwnerType,
  ownerId: string,
): Promise<Record<string, Record<string, unknown>>> {
  const out: Record<string, Record<string, unknown>> = {}
  for (const r of await typedMetafieldsFor(ctx, ownerType, ownerId)) {
    const ns = out[r.namespace] ?? {}
    ns[r.key] = r.value
    out[r.namespace] = ns
  }
  return out
}
