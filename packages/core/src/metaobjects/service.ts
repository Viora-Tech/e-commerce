import {
  collection,
  media,
  metafield,
  metafieldDefinition,
  metaobject,
  metaobjectDefinition,
  newId,
  product,
  type StoreTx,
} from '@commerce/db'
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { slugify } from '../catalog/slug'
import { type FromPresetInput, presetDefinition } from './presets'
import {
  type FieldDefinition,
  InvalidMetaobject,
  type MetafieldDefinitionWrite,
  type MetafieldOwnerType,
  type MetaobjectDefinitionWrite,
  type MetaobjectWrite,
  type ReferenceType,
} from './schemas'
import {
  collectReferences,
  definitionProblems,
  entryDisplayName,
  keyFromName,
  type ReferenceUse,
  ruleProblems,
  validateFields,
  validateFieldValue,
} from './validate'

/* ------------------------------------------------------------------ */
/* References                                                          */
/* ------------------------------------------------------------------ */

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
  const [files, products, collections, entries] = await Promise.all([
    idsOf('file').length
      ? tx
          .select({ id: media.id })
          .from(media)
          .where(inArray(media.id, idsOf('file')))
      : [],
    idsOf('product_reference').length
      ? tx
          .select({ id: product.id })
          .from(product)
          .where(inArray(product.id, idsOf('product_reference')))
      : [],
    idsOf('collection_reference').length
      ? tx
          .select({ id: collection.id })
          .from(collection)
          .where(inArray(collection.id, idsOf('collection_reference')))
      : [],
    idsOf('metaobject_reference').length
      ? tx
          .select({ id: metaobject.id, definitionId: metaobject.definitionId })
          .from(metaobject)
          .where(inArray(metaobject.id, idsOf('metaobject_reference')))
      : [],
  ])
  const found = {
    file: new Set(files.map((r) => r.id)),
    product_reference: new Set(products.map((r) => r.id)),
    collection_reference: new Set(collections.map((r) => r.id)),
  }
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
    } else if (!found[use.type].has(use.id)) {
      problems[use.source] =
        use.type === 'file'
          ? 'uses a file that was deleted. Pick another file'
          : 'links to something that was deleted. Pick another one'
    }
  }
  return problems
}

/** Metaobject definitions that exist here, for checking `metaobjectDefinitionId` rules. */
async function checkDefinitionTargets(tx: StoreTx, ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return []
  const rows = await tx
    .select({ id: metaobjectDefinition.id })
    .from(metaobjectDefinition)
    .where(inArray(metaobjectDefinition.id, unique))
  const have = new Set(rows.map((r) => r.id))
  return unique
    .filter((id) => !have.has(id))
    .map(() => 'A field links to a content type that was deleted. Pick another one in that field')
}

export type ReferenceOption = {
  id: string
  label: string
  detail: string | null
  imageUrl: string | null
}

/** Picker rows for a reference field: by search text, or the labels of chosen ids. */
export async function referenceOptions(
  tx: StoreTx,
  input: {
    kind: 'product' | 'collection' | 'metaobject' | 'file'
    query?: string | undefined
    ids?: string[] | undefined
    definitionId?: string | undefined
    limit?: number | undefined
  },
): Promise<ReferenceOption[]> {
  const limit = input.limit ?? 20
  const q = input.query?.trim()
  if (input.ids && input.ids.length === 0) return []
  if (input.kind === 'product') {
    const rows = await tx
      .select({
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
      })
      .from(product)
      .where(
        input.ids
          ? inArray(product.id, input.ids)
          : q
            ? or(ilike(product.title, `%${q}%`), ilike(product.handle, `%${q}%`))
            : undefined,
      )
      .orderBy(asc(product.title))
      .limit(input.ids ? input.ids.length : limit)
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
  if (input.kind === 'file') {
    const rows = await tx
      .select({ id: media.id, url: media.url, alt: media.alt, contentType: media.contentType })
      .from(media)
      .where(
        and(
          eq(media.status, 'ready'),
          input.ids ? inArray(media.id, input.ids) : q ? ilike(media.alt, `%${q}%`) : undefined,
        ),
      )
      .orderBy(desc(media.createdAt))
      .limit(input.ids ? input.ids.length : limit)
    return rows.map((r) => ({
      id: r.id,
      label: r.alt || (r.url.split('/').pop() ?? r.url),
      detail: r.contentType,
      imageUrl: r.contentType?.startsWith('image/') || !r.contentType ? r.url : null,
    }))
  }
  if (input.kind === 'collection') {
    const rows = await tx
      .select({
        id: collection.id,
        title: collection.title,
        handle: collection.handle,
        url: media.url,
      })
      .from(collection)
      .leftJoin(media, eq(media.id, collection.imageMediaId))
      .where(
        input.ids
          ? inArray(collection.id, input.ids)
          : q
            ? ilike(collection.title, `%${q}%`)
            : undefined,
      )
      .orderBy(asc(collection.title))
      .limit(input.ids ? input.ids.length : limit)
    return rows.map((r) => ({ id: r.id, label: r.title, detail: r.handle, imageUrl: r.url }))
  }
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
    .limit(input.ids ? input.ids.length : limit)
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

/* ------------------------------------------------------------------ */
/* Metaobject definitions                                              */
/* ------------------------------------------------------------------ */

/** Admin routes under /content/metaobjects that a type handle would shadow. */
const RESERVED_TYPES = ['new']

async function uniqueDefinitionType(tx: StoreTx, base: string, exceptId?: string): Promise<string> {
  const key = keyFromName(base)
  const rows = await tx
    .select({ id: metaobjectDefinition.id, type: metaobjectDefinition.type })
    .from(metaobjectDefinition)
    .where(or(eq(metaobjectDefinition.type, key), ilike(metaobjectDefinition.type, `${key}_%`)))
  const taken = new Set([
    ...RESERVED_TYPES,
    ...rows.filter((r) => r.id !== exceptId).map((r) => r.type),
  ])
  if (!taken.has(key)) return key
  for (let n = 2; ; n++) {
    const candidate = `${key.slice(0, 60)}_${n}`
    if (!taken.has(candidate)) return candidate
  }
}

async function assertDefinitionValid(tx: StoreTx, write: MetaobjectDefinitionWrite) {
  const problems = definitionProblems(write.fields, write.displayNameKey)
  if (write.type && RESERVED_TYPES.includes(write.type))
    problems.push(`The handle ${write.type} is used by the admin. Pick a different handle`)
  problems.push(
    ...(await checkDefinitionTargets(
      tx,
      write.fields.flatMap((f) =>
        f.validations?.metaobjectDefinitionId ? [f.validations.metaobjectDefinitionId] : [],
      ),
    )),
  )
  if (problems.length) throw new InvalidMetaobject(problems)
}

/** Every definition with its entry count, for the Metaobjects index. */
export async function listDefinitions(tx: StoreTx) {
  return tx
    .select({
      id: metaobjectDefinition.id,
      type: metaobjectDefinition.type,
      name: metaobjectDefinition.name,
      description: metaobjectDefinition.description,
      fields: metaobjectDefinition.fields,
      displayNameKey: metaobjectDefinition.displayNameKey,
      storefrontAccess: metaobjectDefinition.storefrontAccess,
      updatedAt: metaobjectDefinition.updatedAt,
      entries: sql<number>`(select count(*)::int from metaobject m where m.definition_id = "metaobject_definition"."id")`,
    })
    .from(metaobjectDefinition)
    .orderBy(asc(metaobjectDefinition.name))
}

export type MetaobjectDefinitionRow = typeof metaobjectDefinition.$inferSelect

export async function getDefinition(
  tx: StoreTx,
  by: { id: string } | { type: string },
): Promise<(MetaobjectDefinitionRow & { entries: number }) | null> {
  const [row] = await tx
    .select()
    .from(metaobjectDefinition)
    .where('id' in by ? eq(metaobjectDefinition.id, by.id) : eq(metaobjectDefinition.type, by.type))
  if (!row) return null
  const [n] = await tx
    .select({ n: count() })
    .from(metaobject)
    .where(eq(metaobject.definitionId, row.id))
  return { ...row, entries: n?.n ?? 0 }
}

export async function createDefinition(
  tx: StoreTx,
  storeId: string,
  write: MetaobjectDefinitionWrite,
): Promise<{ id: string; type: string }> {
  await assertDefinitionValid(tx, write)
  if (write.type) {
    const [clash] = await tx
      .select({ id: metaobjectDefinition.id })
      .from(metaobjectDefinition)
      .where(eq(metaobjectDefinition.type, write.type))
    if (clash)
      throw new InvalidMetaobject([
        `Another content type already uses the handle ${write.type}. Pick a different handle`,
      ])
  }
  const type = write.type ?? (await uniqueDefinitionType(tx, write.name))
  const id = newId()
  await tx.insert(metaobjectDefinition).values({
    id,
    storeId,
    type,
    name: write.name,
    description: write.description || null,
    displayNameKey:
      write.displayNameKey === undefined ? (write.fields[0]?.key ?? null) : write.displayNameKey,
    fields: write.fields,
    storefrontAccess: write.storefrontAccess,
  })
  return { id, type }
}

/**
 * A definition from a ready-made preset (`METAOBJECT_PRESETS`), through the same checks as a
 * blank one. The handle follows the merchant's name, or the preset key when the name has no
 * Latin letters or digits to build one from (a Hindi name like "साइज़ गाइड").
 */
export async function createDefinitionFromPreset(
  tx: StoreTx,
  storeId: string,
  input: FromPresetInput,
): Promise<{ id: string; type: string }> {
  const write = presetDefinition(input)
  const base = /[a-z0-9]/i.test(write.name) ? write.name : input.preset
  return createDefinition(tx, storeId, { ...write, type: await uniqueDefinitionType(tx, base) })
}

/**
 * Update a definition. The type handle is what templates read, so it only
 * changes while the definition has no entries. Removing a field keeps old
 * values in the rows but they are no longer validated or served.
 */
export async function updateDefinition(
  tx: StoreTx,
  id: string,
  write: MetaobjectDefinitionWrite,
): Promise<{ type: string }> {
  const current = await getDefinition(tx, { id })
  if (!current)
    throw new InvalidMetaobject([
      'This content type was deleted. Go back to Content types and open another',
    ])
  await assertDefinitionValid(tx, write)
  let type = current.type
  if (write.type && write.type !== current.type) {
    if (current.entries > 0) {
      throw new InvalidMetaobject([
        'The handle cannot change once the content type has entries. Make a new content type instead',
      ])
    }
    const [clash] = await tx
      .select({ id: metaobjectDefinition.id })
      .from(metaobjectDefinition)
      .where(eq(metaobjectDefinition.type, write.type))
    if (clash)
      throw new InvalidMetaobject([
        `Another content type already uses the handle ${write.type}. Pick a different handle`,
      ])
    type = write.type
  }
  await tx
    .update(metaobjectDefinition)
    .set({
      type,
      name: write.name,
      description: write.description || null,
      displayNameKey:
        write.displayNameKey === undefined ? current.displayNameKey : write.displayNameKey,
      fields: write.fields,
      storefrontAccess: write.storefrontAccess,
      updatedAt: new Date(),
    })
    .where(eq(metaobjectDefinition.id, id))
  return { type }
}

/** Delete a definition and its entries, unless another field or metafield references it. */
export async function deleteDefinition(tx: StoreTx, id: string): Promise<void> {
  const users = await tx
    .select({ name: metaobjectDefinition.name, fields: metaobjectDefinition.fields })
    .from(metaobjectDefinition)
    .where(sql`${metaobjectDefinition.id} <> ${id}`)
  const blocking = users
    .filter((d) => d.fields.some((f) => f.validations?.metaobjectDefinitionId === id))
    .map((d) => d.name)
  const metafields = await tx
    .select({ name: metafieldDefinition.name, ownerType: metafieldDefinition.ownerType })
    .from(metafieldDefinition)
    .where(sql`${metafieldDefinition.validations}->>'metaobjectDefinitionId' = ${id}`)
  blocking.push(...metafields.map((m) => `${m.ownerType} extra field ${m.name}`))
  if (blocking.length) {
    throw new InvalidMetaobject([
      `Still used by ${blocking.join(', ')}. Remove those fields first, then delete it`,
    ])
  }
  await tx.delete(metaobject).where(eq(metaobject.definitionId, id))
  await tx.delete(metaobjectDefinition).where(eq(metaobjectDefinition.id, id))
}

/* ------------------------------------------------------------------ */
/* Entries                                                             */
/* ------------------------------------------------------------------ */

async function uniqueEntryHandle(
  tx: StoreTx,
  definitionId: string,
  base: string,
  exceptId?: string,
): Promise<string> {
  const slug = slugify(base) || 'entry'
  const rows = await tx
    .select({ id: metaobject.id, handle: metaobject.handle })
    .from(metaobject)
    .where(
      and(
        eq(metaobject.definitionId, definitionId),
        or(eq(metaobject.handle, slug), ilike(metaobject.handle, `${slug}-%`)),
      ),
    )
  const taken = new Set(rows.filter((r) => r.id !== exceptId).map((r) => r.handle))
  if (!taken.has(slug)) return slug
  for (let n = 2; ; n++) {
    const candidate = `${slug}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

/** Validate entry values against the definition and confirm every reference exists. */
async function validEntryValues(
  tx: StoreTx,
  fields: FieldDefinition[],
  raw: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { values, fieldErrors } = validateFields(fields, raw)
  if (Object.keys(fieldErrors).length === 0) {
    const refs = await referenceProblems(
      tx,
      collectReferences(
        fields.map((f) => ({ ...f, source: f.key })),
        values,
      ),
    )
    for (const [key, message] of Object.entries(refs)) {
      const name = fields.find((f) => f.key === key)?.name ?? key
      fieldErrors[key] = `${name} ${message}`
    }
  }
  if (Object.keys(fieldErrors).length) {
    throw new InvalidMetaobject(Object.values(fieldErrors), fieldErrors)
  }
  return values
}

export async function listEntries(
  tx: StoreTx,
  input: { definitionId: string; page: number; perPage: number; query?: string | undefined },
) {
  const def = await getDefinition(tx, { id: input.definitionId })
  if (!def) return { rows: [], total: 0 }
  const q = input.query?.trim()
  const where = and(
    eq(metaobject.definitionId, input.definitionId),
    q
      ? or(ilike(metaobject.handle, `%${q}%`), sql`${metaobject.fields}::text ilike ${`%${q}%`}`)
      : undefined,
  )
  const [rows, [total]] = await Promise.all([
    tx
      .select()
      .from(metaobject)
      .where(where)
      .orderBy(desc(metaobject.updatedAt))
      .limit(input.perPage)
      .offset((input.page - 1) * input.perPage),
    tx.select({ n: count() }).from(metaobject).where(where),
  ])
  return {
    rows: rows.map((r) => ({
      id: r.id,
      handle: r.handle,
      status: r.status,
      displayName: entryDisplayName(def.displayNameKey, r.fields, r.handle),
      fields: r.fields,
      updatedAt: r.updatedAt,
    })),
    total: total?.n ?? 0,
  }
}

export async function getEntry(tx: StoreTx, id: string) {
  const [row] = await tx.select().from(metaobject).where(eq(metaobject.id, id))
  return row ?? null
}

export async function createEntry(
  tx: StoreTx,
  storeId: string,
  write: MetaobjectWrite,
): Promise<{ id: string; handle: string }> {
  const def = await getDefinition(tx, { id: write.definitionId })
  if (!def)
    throw new InvalidMetaobject([
      'This content type was deleted. Go back to Content types and open another',
    ])
  const values = await validEntryValues(tx, def.fields, write.fields)
  const base = write.handle || entryDisplayName(def.displayNameKey, values, def.name)
  const handle = await uniqueEntryHandle(tx, def.id, base)
  const id = newId()
  await tx.insert(metaobject).values({
    id,
    storeId,
    definitionId: def.id,
    handle,
    fields: values,
    status: write.status,
  })
  return { id, handle }
}

export async function updateEntry(
  tx: StoreTx,
  id: string,
  write: MetaobjectWrite,
): Promise<{ handle: string }> {
  const current = await getEntry(tx, id)
  if (!current || current.definitionId !== write.definitionId) {
    throw new InvalidMetaobject(['This entry was deleted. Go back to the list and open another'])
  }
  const def = await getDefinition(tx, { id: current.definitionId })
  if (!def)
    throw new InvalidMetaobject([
      'This content type was deleted. Go back to Content types and open another',
    ])
  const values = await validEntryValues(tx, def.fields, write.fields)
  const handle =
    write.handle && slugify(write.handle) !== current.handle
      ? await uniqueEntryHandle(tx, def.id, write.handle, id)
      : current.handle
  await tx
    .update(metaobject)
    .set({ handle, fields: values, status: write.status, updatedAt: new Date() })
    .where(eq(metaobject.id, id))
  return { handle }
}

export async function deleteEntries(tx: StoreTx, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const rows = await tx
    .delete(metaobject)
    .where(inArray(metaobject.id, ids))
    .returning({ id: metaobject.id })
  return rows.length
}

/* ------------------------------------------------------------------ */
/* Metafield definitions and values                                     */
/* ------------------------------------------------------------------ */

export type MetafieldDefinitionRow = typeof metafieldDefinition.$inferSelect

export async function listMetafieldDefinitions(tx: StoreTx, ownerType: MetafieldOwnerType) {
  return tx
    .select({
      id: metafieldDefinition.id,
      ownerType: metafieldDefinition.ownerType,
      namespace: metafieldDefinition.namespace,
      key: metafieldDefinition.key,
      name: metafieldDefinition.name,
      description: metafieldDefinition.description,
      type: metafieldDefinition.type,
      list: metafieldDefinition.list,
      validations: metafieldDefinition.validations,
      storefrontAccess: metafieldDefinition.storefrontAccess,
      position: metafieldDefinition.position,
      values: sql<number>`(select count(*)::int from metafield v where v.definition_id = "metafield_definition"."id")`,
    })
    .from(metafieldDefinition)
    .where(eq(metafieldDefinition.ownerType, ownerType))
    .orderBy(asc(metafieldDefinition.position), asc(metafieldDefinition.createdAt))
}

async function assertMetafieldRules(tx: StoreTx, write: MetafieldDefinitionWrite) {
  const problems = ruleProblems(write.name, write.type, write.validations)
  if (write.list && ['boolean', 'rich_text', 'multi_line_text'].includes(write.type)) {
    problems.push(`${write.name} cannot be a list`)
  }
  if (write.validations.metaobjectDefinitionId) {
    problems.push(...(await checkDefinitionTargets(tx, [write.validations.metaobjectDefinitionId])))
  }
  if (problems.length) throw new InvalidMetaobject(problems)
}

export async function createMetafieldDefinition(
  tx: StoreTx,
  storeId: string,
  write: MetafieldDefinitionWrite,
): Promise<{ id: string; key: string }> {
  await assertMetafieldRules(tx, write)
  const key = write.key ?? keyFromName(write.name)
  const [clash] = await tx
    .select({ id: metafieldDefinition.id })
    .from(metafieldDefinition)
    .where(
      and(
        eq(metafieldDefinition.ownerType, write.ownerType),
        eq(metafieldDefinition.namespace, write.namespace),
        eq(metafieldDefinition.key, key),
      ),
    )
  if (clash) throw new InvalidMetaobject([`${write.namespace}.${key} is already defined`])
  const [last] = await tx
    .select({ n: sql<number>`coalesce(max(${metafieldDefinition.position}), -1)::int` })
    .from(metafieldDefinition)
    .where(eq(metafieldDefinition.ownerType, write.ownerType))
  const id = newId()
  await tx.insert(metafieldDefinition).values({
    id,
    storeId,
    ownerType: write.ownerType,
    namespace: write.namespace,
    key,
    name: write.name,
    description: write.description || null,
    type: write.type,
    list: write.list,
    validations: write.validations,
    storefrontAccess: write.storefrontAccess,
    position: (last?.n ?? -1) + 1,
  })
  return { id, key }
}

/** Name, description, rules and access can change; owner, key, type and list are fixed. */
export async function updateMetafieldDefinition(
  tx: StoreTx,
  id: string,
  write: MetafieldDefinitionWrite,
): Promise<void> {
  const [current] = await tx
    .select()
    .from(metafieldDefinition)
    .where(eq(metafieldDefinition.id, id))
  if (!current)
    throw new InvalidMetaobject([
      'This extra field was deleted. Reload the page to see the current list',
    ])
  if (
    current.ownerType !== write.ownerType ||
    current.type !== write.type ||
    current.list !== write.list ||
    (write.key && write.key !== current.key) ||
    write.namespace !== current.namespace
  ) {
    throw new InvalidMetaobject([
      'The key and type of an extra field cannot change after it is made. Make a new extra field instead',
    ])
  }
  await assertMetafieldRules(tx, write)
  await tx
    .update(metafieldDefinition)
    .set({
      name: write.name,
      description: write.description || null,
      validations: write.validations,
      storefrontAccess: write.storefrontAccess,
      updatedAt: new Date(),
    })
    .where(eq(metafieldDefinition.id, id))
}

/** Removes the definition and every value stored for it. */
export async function deleteMetafieldDefinition(tx: StoreTx, id: string): Promise<void> {
  await tx.delete(metafield).where(eq(metafield.definitionId, id))
  await tx.delete(metafieldDefinition).where(eq(metafieldDefinition.id, id))
}

async function ownerExists(tx: StoreTx, ownerType: MetafieldOwnerType, ownerId: string) {
  const table = ownerType === 'product' ? product : collection
  const [row] = await tx.select({ id: table.id }).from(table).where(eq(table.id, ownerId))
  return Boolean(row)
}

/** Definitions for an owner type with this owner's values, keyed by definition id. */
export async function getMetafields(tx: StoreTx, ownerType: MetafieldOwnerType, ownerId: string) {
  const [definitions, rows] = await Promise.all([
    listMetafieldDefinitions(tx, ownerType),
    tx
      .select({ definitionId: metafield.definitionId, value: metafield.value })
      .from(metafield)
      .where(and(eq(metafield.ownerType, ownerType), eq(metafield.ownerId, ownerId))),
  ])
  const values: Record<string, unknown> = {}
  for (const r of rows) values[r.definitionId] = r.value
  return { definitions, values }
}

/**
 * Save values for one product or collection, keyed by definition id. Empty
 * values delete the row; everything is validated (and references confirmed)
 * before anything is written.
 */
export async function setMetafields(
  tx: StoreTx,
  storeId: string,
  input: { ownerType: MetafieldOwnerType; ownerId: string; values: Record<string, unknown> },
): Promise<void> {
  if (!(await ownerExists(tx, input.ownerType, input.ownerId))) {
    throw new InvalidMetaobject([`This ${input.ownerType} no longer exists`])
  }
  const definitions = await listMetafieldDefinitions(tx, input.ownerType)
  const byId = new Map(definitions.map((d) => [d.id, d]))
  const fieldErrors: Record<string, string> = {}
  const clean: Record<string, unknown> = {}
  for (const [definitionId, raw] of Object.entries(input.values)) {
    const def = byId.get(definitionId)
    if (!def) {
      fieldErrors[definitionId] = 'This extra field was deleted. Reload the page and save again'
      continue
    }
    const r = validateFieldValue({ ...def, required: false }, raw)
    if (!r.ok) fieldErrors[definitionId] = r.error
    else clean[definitionId] = r.value
  }
  if (Object.keys(fieldErrors).length === 0) {
    const refs = await referenceProblems(
      tx,
      collectReferences(
        definitions.map((d) => ({ ...d, source: d.id })),
        clean,
      ),
    )
    for (const [id, message] of Object.entries(refs)) {
      fieldErrors[id] = `${byId.get(id)?.name ?? id} ${message}`
    }
  }
  if (Object.keys(fieldErrors).length) {
    throw new InvalidMetaobject(Object.values(fieldErrors), fieldErrors)
  }
  for (const [definitionId, value] of Object.entries(clean)) {
    if (value === null) {
      await tx
        .delete(metafield)
        .where(and(eq(metafield.definitionId, definitionId), eq(metafield.ownerId, input.ownerId)))
      continue
    }
    await tx
      .insert(metafield)
      .values({
        storeId,
        definitionId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        value,
      })
      .onConflictDoUpdate({
        target: [metafield.definitionId, metafield.ownerId],
        set: { value, updatedAt: new Date() },
      })
  }
}
