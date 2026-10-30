/**
 * Store settings import: read the chosen parts from Shopify, compare them with this
 * store (`settings-plan.ts`) and, on import, write each chosen part in its own savepoint
 * so one part failing leaves the others saved. Never touches orders or stock: new
 * locations hold no stock and neither sell online nor become the default.
 */
import {
  addRegistration,
  createMetafieldDefinition,
  createShippingZone,
  defaultRegistrationGstin,
  listBusinessGst,
  listLocations,
  listMetafieldDefinitions,
  listPolicies,
  listShippingZones,
  type MetafieldOwnerType,
  readStoreProfile,
  saveLocationDetails,
  savePolicy,
  saveStoreProfile,
  updateShippingZone,
} from '@commerce/core'
import { PREFERENCE_LIMITS, parsePreferences } from '@commerce/core/preferences'
import { type StoreTx, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { fetchSettingsSource, type Read, type SettingsSource } from './api-settings'
import { type ClientForOptions, clientFor } from './connection'
import { findMappings, saveMapping } from './runtime'
import { ImportError } from './service'
import {
  changes,
  SETTINGS_PART_SCOPES,
  SETTINGS_PARTS,
  type SettingsPart,
  type SettingsPartPlan,
  type SettingsPartResult,
  type SettingsPlan,
} from './settings-client'
import {
  type LocalSettings,
  type PartPlan,
  planLocations,
  planStore,
  planTax,
  SETTINGS_MAPPINGS,
  type SettingsOp,
} from './settings-plan'
import { planFields, planPolicies } from './settings-plan-content'
import { planPackages, planShipping } from './settings-plan-shipping'

type PlannedPart = SettingsPartPlan & { ops: SettingsOp[] }

const FIELD_OWNER_TYPES: MetafieldOwnerType[] = [
  'product',
  'variant',
  'collection',
  'customer',
  'order',
]

/** What this store has now, with the import mappings of the Shopify records just read. */
/** The home page title and meta description this store has now (Online store › Preferences). */
async function readHomeSeo(tx: StoreTx, storeId: string) {
  const [row] = await tx
    .select({ preferences: store.preferences })
    .from(store)
    .where(eq(store.id, storeId))
  const { seo } = parsePreferences(row?.preferences)
  return { title: seo.title, description: seo.description }
}

/** Fill the home page SEO, keeping every other preference (and the share image) as it is. */
async function saveHomeSeo(
  tx: StoreTx,
  storeId: string,
  op: { title?: string | undefined; description?: string | undefined },
) {
  const [row] = await tx
    .select({ preferences: store.preferences })
    .from(store)
    .where(eq(store.id, storeId))
  const prefs = parsePreferences(row?.preferences)
  const seo = {
    ...prefs.seo,
    ...(op.title ? { title: op.title.slice(0, PREFERENCE_LIMITS.seoTitle) } : {}),
    ...(op.description
      ? { description: op.description.slice(0, PREFERENCE_LIMITS.seoDescription) }
      : {}),
  }
  await tx
    .update(store)
    .set({ preferences: { ...((row?.preferences as object | null) ?? {}), seo } })
    .where(eq(store.id, storeId))
}

async function loadLocal(
  tx: StoreTx,
  storeId: string,
  source: SettingsSource,
): Promise<LocalSettings> {
  const ctx = { tx, storeId }
  const gst = await listBusinessGst(tx, storeId)
  const fields = []
  for (const owner of FIELD_OWNER_TYPES) fields.push(...(await listMetafieldDefinitions(tx, owner)))
  const okData = <T>(r: Read<T> | null): T | null => (r?.ok ? r.data : null)
  const zoneIds = (okData(source.profiles) ?? []).flatMap((p) => p.zones.map((z) => z.sourceId))
  const defs = (source.fields ?? []).flatMap((f) =>
    f.read.ok ? f.read.data.map((d) => ({ owner: f.owner, def: d })) : [],
  )
  const targets = defs.flatMap(({ def }) =>
    def.validations.filter((v) => v.name === 'metaobject_definition_id').map((v) => v.value),
  )
  return {
    profile: await readStoreProfile(ctx),
    seo: await readHomeSeo(tx, storeId),
    defaultGstin: await defaultRegistrationGstin(tx),
    gstins: gst.registrations.filter((r) => r.active).map((r) => r.gstin),
    locations: (await listLocations(tx, storeId)).map((l) => ({
      id: l.id,
      isDefault: l.isDefault,
      name: l.name,
      line1: l.line1 ?? '',
      line2: l.line2 ?? '',
      city: l.city ?? '',
      stateCode: l.stateCode ?? '',
      pincode: l.pincode ?? '',
      country: l.country,
      phone: l.phone ?? '',
    })),
    zones: await listShippingZones(tx),
    policies: (await listPolicies(ctx)).map((p) => ({
      type: p.type,
      exists: p.pageId !== null,
      title: p.title,
      body: p.body,
      published: p.published,
    })),
    fields: fields.map((f) => ({
      id: f.id,
      ownerType: f.ownerType,
      namespace: f.namespace,
      key: f.key,
      type: f.type,
      list: f.list,
    })),
    mapped: {
      locations: await findMappings(
        tx,
        SETTINGS_MAPPINGS.locations,
        (okData(source.locations) ?? []).map((l) => l.sourceId),
      ),
      zones: await findMappings(tx, SETTINGS_MAPPINGS.zones, zoneIds),
      fields: await findMappings(
        tx,
        SETTINGS_MAPPINGS.fields,
        defs.map(({ owner, def }) => `${owner.shopify}:${def.namespace}.${def.key}`),
      ),
      contentTypes: await findMappings(tx, 'metaobject_definitions', targets),
    },
  }
}

/** A part whose read failed: ask to reconnect when a scope is missing, else show the error. */
function unread(part: SettingsPart, r: Extract<Read<unknown>, { ok: false }>): PlannedPart {
  return r.access
    ? { part, state: 'access', items: [], ops: [], missingScopes: SETTINGS_PART_SCOPES[part] }
    : { part, state: 'failed', items: [], ops: [], error: r.error }
}

function ready(part: SettingsPart, plan: PartPlan): PlannedPart {
  return { part, state: plan.items.some(changes) ? 'ready' : 'same', ...plan }
}

function planPart(part: SettingsPart, source: SettingsSource, local: LocalSettings): PlannedPart {
  switch (part) {
    case 'store':
      return ready(part, planStore(source.shop, local))
    case 'tax':
      return ready(part, planTax(source.shop, local))
    case 'locations': {
      const r = source.locations
      if (!r) return ready(part, { items: [], ops: [] })
      return r.ok ? ready(part, planLocations(r.data, local)) : unread(part, r)
    }
    case 'shipping': {
      const r = source.profiles
      if (!r) return ready(part, { items: [], ops: [] })
      if (!r.ok) return unread(part, r)
      const locations = source.locations?.ok ? source.locations.data : null
      return ready(part, planShipping(r.data, locations, local))
    }
    case 'packages':
      return ready(part, planPackages())
    case 'policies': {
      const r = source.policies
      if (!r) return ready(part, { items: [], ops: [] })
      return r.ok ? ready(part, planPolicies(r.data, local)) : unread(part, r)
    }
    case 'fields': {
      const reads = source.fields ?? []
      const failed = reads.flatMap((f) => (f.read.ok ? [] : [{ owner: f.owner, read: f.read }]))
      const first = failed[0]
      if (first && failed.length === reads.length) return unread(part, first.read)
      const plan = planFields(
        reads.flatMap((f) => (f.read.ok ? [{ owner: f.owner, definitions: f.read.data }] : [])),
        local,
      )
      // Customers or orders the connection may not read: their fields are named, the rest come over.
      for (const f of failed) {
        plan.items.push({
          action: 'warn',
          subject: 'field',
          owner: f.owner.ours,
          reason: 'owner_access',
          detail: f.read.error,
        })
      }
      return ready(part, plan)
    }
  }
}

async function plan(
  tx: StoreTx,
  storeId: string,
  secret: string,
  parts: readonly SettingsPart[],
  opts: ClientForOptions,
): Promise<{ shopName: string; parts: PlannedPart[] }> {
  const client = await clientFor(tx, secret, opts)
  if (!client) throw new ImportError('Connect your Shopify store first')
  const chosen = SETTINGS_PARTS.filter((p) => parts.includes(p))
  const source = await fetchSettingsSource(client, chosen)
  const local = await loadLocal(tx, storeId, source)
  return { shopName: source.shop.name, parts: chosen.map((p) => planPart(p, source, local)) }
}

/** "Check Shopify": every part's plan. Reads only; nothing here changes. */
export async function previewStoreSettings(
  tx: StoreTx,
  storeId: string,
  secret: string,
  opts: ClientForOptions = {},
): Promise<SettingsPlan> {
  const planned = await plan(tx, storeId, secret, SETTINGS_PARTS, opts)
  return {
    shopName: planned.shopName,
    parts: planned.parts.map(({ ops: _ops, ...part }) => part),
  }
}

async function apply(tx: StoreTx, storeId: string, op: SettingsOp): Promise<void> {
  const ctx = { tx, storeId }
  switch (op.kind) {
    case 'profile':
      return saveStoreProfile(ctx, op.patch)
    case 'location': {
      const id = await saveLocationDetails(ctx, op.id, op.details)
      return saveMapping(tx, storeId, SETTINGS_MAPPINGS.locations, op.sourceId, id)
    }
    case 'gstin':
      await addRegistration(tx, storeId, { gstin: op.gstin, makeDefault: true })
      return
    case 'seo':
      return saveHomeSeo(tx, storeId, op)
    case 'zone': {
      const zone = op.id
        ? await updateShippingZone(tx, storeId, op.id, op.write)
        : await createShippingZone(tx, storeId, op.write)
      return saveMapping(tx, storeId, SETTINGS_MAPPINGS.zones, op.sourceId, zone.id)
    }
    case 'policy':
      await savePolicy(ctx, {
        type: op.type,
        title: op.title,
        body: op.body,
        published: op.published,
      })
      return
    case 'field': {
      const created = await createMetafieldDefinition(tx, storeId, op.write)
      return saveMapping(tx, storeId, SETTINGS_MAPPINGS.fields, op.sourceId, created.id)
    }
    case 'map':
      return saveMapping(tx, storeId, op.resource, op.sourceId, op.localId)
  }
}

/**
 * Import the chosen parts. Shopify is read again (not the preview the merchant saw), so
 * what is written is current; each part runs in a savepoint and reports on its own.
 */
export async function importStoreSettings(
  tx: StoreTx,
  storeId: string,
  secret: string,
  parts: readonly SettingsPart[],
  opts: ClientForOptions = {},
): Promise<SettingsPartResult[]> {
  const planned = await plan(tx, storeId, secret, parts, opts)
  const results: SettingsPartResult[] = []
  for (const part of SETTINGS_PARTS) {
    const p = planned.parts.find((x) => x.part === part)
    if (!p) {
      results.push({ part, state: 'skipped', applied: 0, items: [] })
      continue
    }
    const { ops, state, ...rest } = p
    if (state !== 'ready' && state !== 'same') {
      results.push({ ...rest, state, applied: 0 })
      continue
    }
    try {
      // `same` parts may still record matches (`map` ops), so a later rename keeps them paired.
      await tx.transaction(async (sp) => {
        for (const op of ops) await apply(sp, storeId, op)
      })
      const applied = p.items.filter(changes).length
      results.push({ ...rest, state: applied ? 'done' : 'same', applied })
    } catch (err) {
      results.push({
        ...rest,
        state: 'failed',
        applied: 0,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return results
}
