/**
 * Shopify metafields → our extra fields on products and collections. A field
 * definition is made the first time a namespace.key shows up (Shopify's own
 * definition when there is one, else one built from the value), then each
 * owner's values are converted, their links resolved and saved together.
 * Every other owner type is only counted for the report.
 */
import {
  createMetafieldDefinition,
  getMetafields,
  listMetafieldDefinitions,
  type MetafieldOwnerType,
  setMetafields,
} from '@commerce/core'
import {
  countOtherMetafields,
  fetchMetafieldDefinitions,
  fetchOwnerMetafields,
} from './api-metafields'
import { planField } from './field-plans'
import { convertFields, type FieldPlan, localKey, nameFromKey } from './field-values'
import type { ReferenceResolver } from './references'
import { errorMessage, findMapping, type ImportContext, saveMapping } from './runtime'
import type { ShopifyClient } from './shopify-client'
import type {
  MetafieldOwner,
  NFieldDefinition,
  NMetafieldDefinition,
  NOwnerMetafields,
} from './types'

const R = 'metafields'
const OWNERS: { shopify: MetafieldOwner; ours: MetafieldOwnerType; resource: string }[] = [
  { shopify: 'PRODUCT', ours: 'product', resource: 'products' },
  { shopify: 'COLLECTION', ours: 'collection', resource: 'collections' },
]
/** Stands in for a content type a preview has not made yet. */
const PLANNED_ID = '00000000-0000-4000-8000-000000000000'
/** Already imported as the page's SEO title and description. */
const SKIP = new Set(['global.title_tag', 'global.description_tag'])

/** A namespace.key's fate on one owner type: our definition (null on a dry run) and plan, or none. */
type Slot = { defId: string | null; plan: FieldPlan } | null

type Owner = (typeof OWNERS)[number]

class DefinitionCache {
  private readonly slots = new Map<string, Slot>()
  private readonly shopifyDefs = new Map<string, NMetafieldDefinition>()

  constructor(
    private readonly ctx: ImportContext,
    private readonly owner: Owner,
    defs: NMetafieldDefinition[],
  ) {
    for (const d of defs) this.shopifyDefs.set(`${d.namespace}.${d.key}`, d)
  }

  /** Shopify's definitions with no values yet still become fields. */
  async warm() {
    for (const [nsKey, def] of this.shopifyDefs) await this.slot(nsKey, def.type)
  }

  private async targets(def: NFieldDefinition): Promise<Map<string, string>> {
    const target = def.validations.find((v) => v.name === 'metaobject_definition_id')?.value
    if (!target) return new Map()
    const id = await this.ctx.inStore((tx) => findMapping(tx, 'metaobject_definitions', target))
    // A preview has not made the content types yet; it assumes they will be there.
    const local = id ?? (this.ctx.dryRun ? PLANNED_ID : null)
    return local ? new Map([[target, local]]) : new Map()
  }

  async slot(nsKey: string, valueType: string): Promise<Slot> {
    if (this.slots.has(nsKey)) return this.slots.get(nsKey) ?? null
    const [namespace = 'custom', ...rest] = nsKey.split('.')
    const shopifyKey = rest.join('.')
    const def: NFieldDefinition = this.shopifyDefs.get(nsKey) ?? {
      key: shopifyKey,
      name: nameFromKey(shopifyKey),
      description: null,
      required: false,
      type: valueType,
      validations: [],
    }
    const key = localKey(shopifyKey)
    const ns = localKey(namespace)
    const planned = planField(def, key, await this.targets(def), true)
    if (planned.status !== 'ok') {
      if (planned.status === 'unsupported') {
        this.ctx.report.leave(R, planned.reason, 1, planned.detail)
        this.ctx.report.issue({
          resource: R,
          ref: `${this.owner.ours} ${nsKey}`,
          message:
            planned.reason === 'field_type'
              ? `Type ${planned.detail} has no matching field type here; its values stay in Shopify`
              : 'Links to entries of a content type that was not imported; its values stay in Shopify',
        })
      }
      this.slots.set(nsKey, null)
      return null
    }
    if (planned.plan.mapping.lossy) this.ctx.report.leave(R, planned.plan.mapping.lossy)
    const sourceId = `${this.owner.shopify}:${nsKey}`
    const defId = await this.ctx
      .inStore(async (tx) => {
        const mapped = await findMapping(tx, 'metafield_definitions', sourceId)
        const existing = (await listMetafieldDefinitions(tx, this.owner.ours)).find((d) =>
          mapped ? d.id === mapped : d.namespace === ns && d.key === key,
        )
        if (existing) {
          if (existing.type !== planned.field.type || existing.list !== planned.field.list) {
            throw new Error(
              `${ns}.${key} already exists here as another type; its values were not imported`,
            )
          }
          return existing.id
        }
        if (this.ctx.dryRun) return null
        const created = await createMetafieldDefinition(tx, this.ctx.storeId, {
          ownerType: this.owner.ours,
          name: planned.field.name,
          namespace: ns,
          key,
          description: planned.field.description ?? null,
          type: planned.field.type,
          list: planned.field.list,
          validations: planned.field.validations ?? {},
          storefrontAccess: true,
        })
        await saveMapping(tx, this.ctx.storeId, 'metafield_definitions', sourceId, created.id)
        return created.id
      })
      .catch((err: unknown) => {
        this.ctx.report.issue({
          resource: R,
          ref: `${this.owner.ours} ${nsKey}`,
          message: errorMessage(err),
        })
        return false as const
      })
    const slot: Slot = defId === false ? null : { defId, plan: planned.plan }
    this.slots.set(nsKey, slot)
    return slot
  }
}

async function writeOwner(
  ctx: ImportContext,
  owner: Owner,
  cache: DefinitionCache,
  o: NOwnerMetafields,
  resolver: ReferenceResolver,
) {
  const values = o.metafields.filter((m) => !SKIP.has(`${m.namespace}.${m.key}`) && m.value)
  if (values.length === 0) return
  ctx.report.addTotal(R, values.length)
  const ref = `${owner.ours} ${o.handle}`
  const ownerId = await ctx.inStore((tx) => findMapping(tx, owner.resource, o.ownerSourceId))
  // Our definitions first, so each value knows its plan; keyed by namespace.key.
  const plans = new Map<string, FieldPlan>()
  const defIds = new Map<string, string | null>()
  for (const m of values) {
    const nsKey = `${m.namespace}.${m.key}`
    const slot = await cache.slot(nsKey, m.type)
    if (slot) {
      // Keyed by namespace.key, so custom.size and other.size never share a slot.
      plans.set(nsKey, { ...slot.plan, localKey: nsKey })
      defIds.set(nsKey, slot.defId)
    }
  }
  const unplanned = values.filter((m) => !plans.has(`${m.namespace}.${m.key}`)).length
  for (let i = 0; i < unplanned; i++) ctx.report.count(R, 'skipped')
  const planned = values.filter((m) => plans.has(`${m.namespace}.${m.key}`))
  if (planned.length === 0) return
  const existing = ownerId
    ? await ctx.inStore((tx) => getMetafields(tx, owner.ours, ownerId))
    : { values: {} as Record<string, unknown> }
  const had = (nsKey: string) => {
    const id = defIds.get(nsKey)
    return Boolean(id && existing.values[id] !== undefined)
  }
  if (ctx.dryRun) {
    for (const m of planned)
      ctx.report.count(R, had(`${m.namespace}.${m.key}`) ? 'updated' : 'created')
    ctx.report.sample({
      resource: R,
      key: ref,
      title: o.handle,
      action: planned.some((m) => had(`${m.namespace}.${m.key}`)) ? 'update' : 'create',
      detail: `${planned.length} extra ${planned.length === 1 ? 'field' : 'fields'} on a ${owner.ours}`,
    })
    return
  }
  if (!ownerId) {
    for (const _ of planned) ctx.report.count(R, 'skipped')
    ctx.report.issue({
      resource: R,
      ref,
      message: `This ${owner.ours} was not imported, so its ${planned.length} extra fields were not either`,
    })
    return
  }
  const converted = await convertFields(
    plans,
    planned.map((m) => ({ key: `${m.namespace}.${m.key}`, type: m.type, value: m.value })),
    (r) => resolver.resolve(r),
    { deferEntries: false },
  )
  if (converted.problems.length) {
    ctx.report.leave(R, 'field_value', converted.problems.length)
    for (const message of converted.problems) ctx.report.issue({ resource: R, ref, message })
  }
  const byDef: Record<string, unknown> = {}
  for (const m of planned) {
    const nsKey = `${m.namespace}.${m.key}`
    const plan = plans.get(nsKey)
    const defId = defIds.get(nsKey)
    if (plan && defId && converted.values[nsKey] !== undefined) {
      byDef[defId] = converted.values[nsKey]
    }
  }
  try {
    await ctx.inStore((tx) =>
      setMetafields(tx, ctx.storeId, { ownerType: owner.ours, ownerId, values: byDef }),
    )
    for (const m of planned) {
      const nsKey = `${m.namespace}.${m.key}`
      const id = defIds.get(nsKey)
      if (!id || byDef[id] === undefined) ctx.report.count(R, 'skipped')
      else ctx.report.count(R, had(nsKey) ? 'updated' : 'created')
    }
  } catch (err) {
    for (const _ of planned) ctx.report.count(R, 'failed')
    ctx.report.issue({ resource: R, ref, sourceId: o.ownerSourceId, message: errorMessage(err) })
  }
}

/** Product and collection extra fields, then a count of what other owners carry. */
export async function importMetafields(
  ctx: ImportContext,
  client: ShopifyClient,
  resolver: ReferenceResolver,
  onBulkFallback: (reason: unknown) => void,
): Promise<void> {
  ctx.report.begin(R)
  for (const owner of OWNERS) {
    const cache = new DefinitionCache(
      ctx,
      owner,
      await fetchMetafieldDefinitions(client, owner.shopify),
    )
    await cache.warm()
    for await (const batch of fetchOwnerMetafields(client, owner.shopify, onBulkFallback)) {
      for (const o of batch) {
        await writeOwner(ctx, owner, cache, o, resolver)
        await ctx.report.flush()
      }
    }
  }
  const others = await countOtherMetafields(client, (ownerType, err) =>
    ctx.log(`metafield count for ${ownerType} skipped: ${errorMessage(err)}`),
  )
  for (const o of others) {
    ctx.report.leave(R, 'metafield_owner', o.values, o.ownerType)
  }
}
