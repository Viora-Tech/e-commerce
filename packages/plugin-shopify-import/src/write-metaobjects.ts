/**
 * Shopify metaobjects → our content types and entries. Order matters because
 * they link to each other:
 *  1. every content type, without links to types not made yet;
 *  2. those types again, now that every link target exists;
 *  3. every entry, without links to entries not written yet;
 *  4. the entries that had such links, again.
 * Matched on the import mapping first, then the type handle / entry handle,
 * so a second run updates instead of duplicating.
 */
import {
  createDefinition,
  createEntry,
  type FieldDefinition,
  getDefinition,
  getEntry,
  type MetaobjectDefinitionWrite,
  updateDefinition,
  updateEntry,
} from '@commerce/core'
import { metaobject, type StoreTx } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import { fetchMetaobjectDefinitions, fetchMetaobjects } from './api-metaobjects'
import { type PlannedField, planFields } from './field-plans'
import { convertFields, type FieldPlan, localKey } from './field-values'
import type { ReferenceResolver } from './references'
import { errorMessage, findMapping, type ImportContext, saveMapping } from './runtime'
import type { ShopifyClient } from './shopify-client'
import type { NMetaobject, NMetaobjectDefinition } from './types'

const DEFS = 'metaobject_definitions'
const ENTRIES = 'metaobjects'
/** Stands in for a content type a dry run would create, so links to it count as fine. */
const PLANNED_ID = '00000000-0000-4000-8000-000000000000'

type Imported = {
  def: NMetaobjectDefinition
  localId: string | null
  plans: Map<string, FieldPlan>
  waiting: Set<string>
}

const okFields = (planned: PlannedField[]) => planned.flatMap((p) => (p.status === 'ok' ? [p] : []))

const plansOf = (planned: PlannedField[]): Map<string, FieldPlan> =>
  new Map(okFields(planned).map((p) => [p.shopifyKey, p.plan]))

async function existingDefinition(ctx: ImportContext, def: NMetaobjectDefinition) {
  return ctx.inStore(async (tx) => {
    const mapped = await findMapping(tx, DEFS, def.sourceId)
    const byId = mapped ? await getDefinition(tx, { id: mapped }) : null
    return byId ?? (await getDefinition(tx, { type: localKey(def.type) }))
  })
}

/** Our write for a Shopify content type, keeping fields the merchant added here. */
async function definitionWrite(
  tx: StoreTx,
  def: NMetaobjectDefinition,
  planned: PlannedField[],
  localId: string | null,
): Promise<MetaobjectDefinitionWrite> {
  const ok = okFields(planned)
  const ours = new Set(ok.map((p) => p.field.key))
  const current = localId ? await getDefinition(tx, { id: localId }) : null
  const extras: FieldDefinition[] = (current?.fields ?? []).filter((f) => !ours.has(f.key))
  const display = ok.find((p) => p.shopifyKey === def.displayNameKey)?.field.key
  return {
    name: def.name.trim().slice(0, 100) || def.type,
    description: def.description?.trim().slice(0, 300) || null,
    ...(display ? { displayNameKey: display } : {}),
    fields: [...ok.map((p) => p.field), ...extras].slice(0, 40),
    storefrontAccess: def.storefrontAccess,
  }
}

/** What stays behind or arrives changed, counted once per field. */
function leaveFields(ctx: ImportContext, planned: PlannedField[]) {
  for (const p of planned) {
    if (p.status === 'unsupported') ctx.report.leave(ENTRIES, p.reason, 1, p.detail)
    if (p.status === 'ok' && p.plan.mapping.lossy) ctx.report.leave(ENTRIES, p.plan.mapping.lossy)
  }
}

/** Steps 1 and 2: content types. Returns what entries need to be written. */
async function writeDefinitions(
  ctx: ImportContext,
  defs: NMetaobjectDefinition[],
): Promise<Imported[]> {
  const targets = new Map<string, string>()
  const existing = new Map<string, string>()
  for (const def of defs) {
    const row = await existingDefinition(ctx, def)
    if (row) existing.set(def.sourceId, row.id)
    const target = row?.id ?? (ctx.dryRun ? PLANNED_ID : null)
    if (target) targets.set(def.sourceId, target)
  }
  const out: Imported[] = []
  for (const def of defs) {
    const before = existing.get(def.sourceId) ?? null
    // A dry run knows every target already (real or planned), so it plans the final shape.
    const planned = planFields(def.fields, targets, ctx.dryRun)
    const waiting = new Set(planned.flatMap((p) => (p.status === 'waiting' ? [p.shopifyKey] : [])))
    leaveFields(ctx, planned)
    if (ctx.dryRun) {
      ctx.report.count(ENTRIES, before ? 'updated' : 'created')
      ctx.report.sample({
        resource: ENTRIES,
        key: def.type,
        title: def.name,
        action: before ? 'update' : 'create',
        detail: `Content type, ${okFields(planned).length} fields`,
      })
      out.push({ def, localId: before, plans: plansOf(planned), waiting })
      continue
    }
    try {
      const localId = await ctx.inStore(async (tx) => {
        const write = await definitionWrite(tx, def, planned, before)
        let id = before
        if (id) await updateDefinition(tx, id, write)
        else
          id = (await createDefinition(tx, ctx.storeId, { ...write, type: localKey(def.type) })).id
        await saveMapping(tx, ctx.storeId, DEFS, def.sourceId, id)
        return id
      })
      targets.set(def.sourceId, localId)
      ctx.report.count(ENTRIES, before ? 'updated' : 'created')
      out.push({ def, localId, plans: plansOf(planned), waiting })
    } catch (err) {
      ctx.report.count(ENTRIES, 'failed')
      ctx.report.issue({ resource: ENTRIES, ref: def.type, message: errorMessage(err) })
      out.push({ def, localId: null, plans: new Map(), waiting: new Set() })
    }
  }
  for (const item of out) {
    const localId = item.localId
    if (!localId || item.waiting.size === 0) continue
    const planned = planFields(item.def.fields, targets, true)
    leaveFields(
      ctx,
      planned.filter((p) => item.waiting.has(p.shopifyKey)),
    )
    try {
      await ctx.inStore(async (tx) =>
        updateDefinition(tx, localId, await definitionWrite(tx, item.def, planned, localId)),
      )
      item.plans = plansOf(planned)
    } catch (err) {
      ctx.report.issue({ resource: ENTRIES, ref: item.def.type, message: errorMessage(err) })
    }
  }
  return out
}

async function existingEntry(ctx: ImportContext, definitionId: string, e: NMetaobject) {
  return ctx.inStore(async (tx) => {
    const mapped = await findMapping(tx, ENTRIES, e.sourceId)
    const row = mapped ? await getEntry(tx, mapped) : null
    if (row && row.definitionId === definitionId) return row
    const [byHandle] = await tx
      .select()
      .from(metaobject)
      .where(and(eq(metaobject.definitionId, definitionId), eq(metaobject.handle, e.handle)))
    return byHandle ?? null
  })
}

/** Steps 3 and 4 for one entry. Returns true when it links to an entry not written yet. */
async function writeEntry(
  ctx: ImportContext,
  item: Imported,
  e: NMetaobject,
  resolver: ReferenceResolver,
  secondPass: boolean,
): Promise<boolean> {
  const ref = `${item.def.type}/${e.handle}`
  const definitionId = item.localId
  const counted = (outcome: 'created' | 'updated' | 'skipped' | 'failed') => {
    if (!secondPass) ctx.report.count(ENTRIES, outcome)
  }
  if (!definitionId && !ctx.dryRun) {
    counted('skipped')
    if (!secondPass) {
      ctx.report.issue({ resource: ENTRIES, ref, message: 'Its content type was not imported' })
    }
    return false
  }
  try {
    const existing = definitionId ? await existingEntry(ctx, definitionId, e) : null
    if (ctx.dryRun || !definitionId) {
      counted(existing ? 'updated' : 'created')
      ctx.report.sample({
        resource: ENTRIES,
        key: ref,
        title: e.displayName,
        action: existing ? 'update' : 'create',
        detail: `Entry of ${item.def.name}`,
      })
      return false
    }
    // The second pass only revisits entry links; everything else was written the first time.
    const fields = secondPass
      ? e.fields.filter((f) => item.plans.get(f.key)?.mapping.type === 'metaobject_reference')
      : e.fields
    const converted = await convertFields(item.plans, fields, (r) => resolver.resolve(r), {
      deferEntries: !secondPass,
    })
    if (converted.problems.length) {
      ctx.report.leave(ENTRIES, 'field_value', converted.problems.length)
      for (const message of converted.problems)
        ctx.report.issue({ resource: ENTRIES, ref, message })
    }
    await ctx.inStore(async (tx) => {
      const write = {
        definitionId,
        handle: e.handle,
        status: e.status,
        fields: { ...(existing?.fields ?? {}), ...converted.values },
      }
      let saved = existing?.id
      if (saved) await updateEntry(tx, saved, write)
      else saved = (await createEntry(tx, ctx.storeId, write)).id
      await saveMapping(tx, ctx.storeId, ENTRIES, e.sourceId, saved)
    })
    counted(existing ? 'updated' : 'created')
    return converted.deferred
  } catch (err) {
    counted('failed')
    ctx.report.issue({ resource: ENTRIES, ref, message: errorMessage(err) })
    return false
  }
}

/** Content types, then their entries, then the links between entries. */
export async function importMetaobjects(
  ctx: ImportContext,
  client: ShopifyClient,
  resolver: ReferenceResolver,
): Promise<void> {
  ctx.report.begin(ENTRIES)
  const defs = await fetchMetaobjectDefinitions(client)
  ctx.report.addTotal(ENTRIES, defs.length)
  const imported = await writeDefinitions(ctx, defs)
  await ctx.report.flush()
  const again: { item: Imported; entry: NMetaobject }[] = []
  for (const item of imported) {
    for await (const batch of fetchMetaobjects(client, item.def)) {
      ctx.report.addTotal(ENTRIES, batch.length)
      for (const entry of batch) {
        if (await writeEntry(ctx, item, entry, resolver, false)) again.push({ item, entry })
        await ctx.report.flush()
      }
    }
  }
  resolver.retryMisses()
  for (const { item, entry } of again) {
    await writeEntry(ctx, item, entry, resolver, true)
    await ctx.report.flush()
  }
}
