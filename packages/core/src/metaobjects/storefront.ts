import {
  collection,
  media,
  metafield,
  metafieldDefinition,
  metaobject,
  metaobjectDefinition,
  product,
} from '@commerce/db'
import { and, asc, eq, inArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import type { FieldType, MetafieldOwnerType } from './schemas'

/**
 * Storefront data layer for custom data. Only definitions with storefront
 * access and active entries are served. References resolve one level deep, so
 * templates get `{ handle, title }` for a product rather than its id, and a
 * metaobject reference carries its own raw fields (not resolved again).
 */

type Ctx = Pick<StoreContext, 'tx'>

export type ResolvedProduct = { id: string; handle: string; title: string }
export type ResolvedCollection = { id: string; handle: string; title: string }
export type ResolvedFile = { id: string; url: string; alt: string | null }
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

type Refs = {
  file: Set<string>
  product: Set<string>
  collection: Set<string>
  metaobject: Set<string>
}

type Loaded = {
  file: Map<string, ResolvedFile>
  product: Map<string, ResolvedProduct>
  collection: Map<string, ResolvedCollection>
  metaobject: Map<string, ResolvedMetaobjectRef>
}

const REF_KIND: Partial<Record<FieldType, keyof Refs>> = {
  file: 'file',
  product_reference: 'product',
  collection_reference: 'collection',
  metaobject_reference: 'metaobject',
}

const emptyRefs = (): Refs => ({
  file: new Set(),
  product: new Set(),
  collection: new Set(),
  metaobject: new Set(),
})

function gather(refs: Refs, type: FieldType, value: unknown) {
  const kind = REF_KIND[type]
  if (!kind) return
  for (const v of Array.isArray(value) ? value : [value]) {
    if (typeof v === 'string') refs[kind].add(v)
  }
}

async function load(ctx: Ctx, refs: Refs): Promise<Loaded> {
  const ids = (s: Set<string>) => [...s]
  const [files, products, collections, entries] = await Promise.all([
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
  ])
  return {
    file: new Map(files.map((r) => [r.id, r])),
    product: new Map(products.map((r) => [r.id, r])),
    collection: new Map(collections.map((r) => [r.id, r])),
    metaobject: new Map(entries.map((r) => [r.id, r])),
  }
}

/** Swap reference ids for loaded records; a missing or hidden target drops out. */
function resolveValue(type: FieldType, value: unknown, loaded: Loaded): unknown {
  const kind = REF_KIND[type]
  if (!kind) return value
  const map = loaded[kind] as Map<string, unknown>
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'string' ? map.get(v) : undefined)).filter(Boolean)
  }
  return typeof value === 'string' ? (map.get(value) ?? null) : null
}

async function resolveEntries(
  ctx: Ctx,
  def: { type: string; fields: { key: string; type: FieldType }[] },
  rows: { id: string; handle: string; fields: Record<string, unknown>; updatedAt: Date }[],
): Promise<StorefrontMetaobject[]> {
  const refs = emptyRefs()
  for (const row of rows) {
    for (const f of def.fields) gather(refs, f.type, row.fields[f.key])
  }
  const loaded = await load(ctx, refs)
  return rows.map((row) => {
    const fields: Record<string, unknown> = {}
    for (const f of def.fields) {
      const v = row.fields[f.key]
      fields[f.key] = v === undefined ? null : resolveValue(f.type, v, loaded)
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
  return resolveEntries(ctx, def, rows)
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
  const [entry] = await resolveEntries(ctx, def, rows)
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
  const refs = emptyRefs()
  for (const r of rows) gather(refs, r.type, r.value)
  const loaded = await load(ctx, refs)
  return rows.map((r) => ({ ...r, value: resolveValue(r.type, r.value, loaded) }))
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
