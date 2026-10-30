/**
 * Store settings import: read the chosen parts from Shopify, compare them with this
 * store (`settings-plan.ts`) and, on import, write each chosen part in its own savepoint
 * so one part failing leaves the others saved. Never touches orders or on-hand stock: new
 * locations hold no stock and neither sell online nor become the default; purchase orders and
 * transfers only add what Shopify still has on the way as incoming (`settings-import-stock.ts`).
 */
import {
  addRegistration,
  createMarket,
  createMetafieldDefinition,
  createShippingProfile,
  createShippingZone,
  defaultRegistrationGstin,
  getShippingProfile,
  listBusinessGst,
  listLocations,
  listMarkets,
  listMetafieldDefinitions,
  listPolicies,
  listShippingProfiles,
  listShippingZones,
  type MetafieldOwnerType,
  readStoreProfile,
  saveLocationDetails,
  savePolicy,
  saveStoreProfile,
  setMarketEnabled,
  updateShippingProfile,
  updateShippingZone,
} from '@commerce/core'
import { PREFERENCE_LIMITS, parsePreferences } from '@commerce/core/preferences'
import {
  customerSegment,
  purchaseOrder,
  type StoreTx,
  store,
  supplier,
  transfer,
  variant,
} from '@commerce/db'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { fetchSettingsSource, type Read, type SettingsSource } from './api-settings'
import { type ClientForOptions, clientFor } from './connection'
import { findMapping, findMappings, saveMapping } from './runtime'
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
import { importPurchaseOrder, importTransfer } from './settings-import-stock'
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
import { planMarkets } from './settings-plan-markets'
import { planSegments } from './settings-plan-segments'
import { planPackages, planShipping } from './settings-plan-shipping'
import { type LocalStock, planPurchaseOrders, planTransfers } from './settings-plan-stock'

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

/** Mapped ids whose record is still here (`existing`); a deleted one may be imported again. */
function stillHere(mapped: Map<string, string>, existing: { id: string }[]): Map<string, string> {
  const ids = new Set(existing.map((r) => r.id))
  return new Map([...mapped].filter(([, id]) => ids.has(id)))
}

/** Suppliers, variants of the imported products the lines name, and earlier imports. */
async function loadStock(tx: StoreTx, source: SettingsSource): Promise<LocalStock> {
  const pos = source.purchaseOrders?.ok ? source.purchaseOrders.data : []
  const transfers = source.transfers?.ok ? source.transfers.data : []
  const lines = [...pos.flatMap((p) => p.lines), ...transfers.flatMap((t) => t.lines)]
  const products = await findMappings(
    tx,
    'products',
    lines.map((l) => l.productSourceId),
  )
  const productIds = [...new Set(products.values())]
  const variants = productIds.length
    ? await tx
        .select({
          id: variant.id,
          productId: variant.productId,
          sku: variant.sku,
          title: variant.title,
        })
        .from(variant)
        .where(and(inArray(variant.productId, productIds), isNull(variant.archivedAt)))
    : []
  const poIds = await findMappings(
    tx,
    SETTINGS_MAPPINGS.purchaseOrders,
    pos.map((p) => p.sourceId),
  )
  const transferIds = await findMappings(
    tx,
    SETTINGS_MAPPINGS.transfers,
    transfers.map((t) => t.sourceId),
  )
  return {
    suppliers: await tx.select({ id: supplier.id, name: supplier.name }).from(supplier),
    products,
    variants,
    purchaseOrders: stillHere(
      poIds,
      poIds.size
        ? await tx
            .select({ id: purchaseOrder.id })
            .from(purchaseOrder)
            .where(inArray(purchaseOrder.id, [...poIds.values()]))
        : [],
    ),
    transfers: stillHere(
      transferIds,
      transferIds.size
        ? await tx
            .select({ id: transfer.id })
            .from(transfer)
            .where(inArray(transfer.id, [...transferIds.values()]))
        : [],
    ),
  }
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
  const shopifyProfiles = okData(source.profiles) ?? []
  const zoneIds = shopifyProfiles.flatMap((p) => p.zones.map((z) => z.sourceId))
  const profiles = await listShippingProfiles(tx, storeId)
  const profileProducts = await Promise.all(
    profiles.map(async (p) =>
      p.isDefault ? [] : ((await getShippingProfile(tx, storeId, p.id))?.productIds ?? []),
    ),
  )
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
    shippingProfiles: profiles.map((p, i) => ({
      id: p.id,
      name: p.name,
      isDefault: p.isDefault,
      productIds: profileProducts[i] ?? [],
    })),
    policies: (await listPolicies(ctx)).map((p) => ({
      type: p.type,
      exists: p.pageId !== null,
      title: p.title,
      body: p.body,
      published: p.published,
    })),
    segments: (await tx.select({ name: customerSegment.name }).from(customerSegment)).map(
      (r) => r.name,
    ),
    markets: (await listMarkets(ctx)).map((m) => ({
      name: m.name,
      isPrimary: m.isPrimary,
      countries: m.countries,
    })),
    stock: await loadStock(tx, source),
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
      shippingProfiles: await findMappings(
        tx,
        SETTINGS_MAPPINGS.shippingProfiles,
        shopifyProfiles.map((p) => p.sourceId),
      ),
      products: await findMappings(
        tx,
        'products',
        shopifyProfiles.flatMap((p) => p.productIds),
      ),
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

function planPart(
  part: SettingsPart,
  source: SettingsSource,
  local: LocalSettings,
  /** Shopify locations the Locations part of this import creates or matches. */
  pending: ReadonlySet<string>,
): PlannedPart {
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
    case 'markets': {
      const r = source.markets
      if (!r) return ready(part, { items: [], ops: [] })
      return r.ok ? ready(part, planMarkets(r.data, local.markets)) : unread(part, r)
    }
    case 'purchase_orders': {
      const r = source.purchaseOrders
      if (!r) return ready(part, { items: [], ops: [] })
      return r.ok ? ready(part, planPurchaseOrders(r.data, local, pending)) : unread(part, r)
    }
    case 'transfers': {
      const r = source.transfers
      if (!r) return ready(part, { items: [], ops: [] })
      return r.ok ? ready(part, planTransfers(r.data, local, pending)) : unread(part, r)
    }
    case 'segments': {
      const r = source.segments
      if (!r) return ready(part, { items: [], ops: [] })
      return r.ok ? ready(part, planSegments(r.data, local)) : unread(part, r)
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
  // Purchase orders and transfers may use a location the Locations part brings over first.
  const pending = new Set<string>()
  if (chosen.includes('locations') && source.locations?.ok) {
    for (const op of planLocations(source.locations.data, local).ops) {
      if ((op.kind === 'location' || op.kind === 'map') && op.sourceId) pending.add(op.sourceId)
    }
  }
  return {
    shopName: source.shop.name,
    parts: chosen.map((p) => planPart(p, source, local, pending)),
  }
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
    case 'segment':
      // The name is unique per store; one made here meanwhile is kept as it is.
      await tx
        .insert(customerSegment)
        .values({ storeId, name: op.name, rules: op.rules })
        .onConflictDoNothing()
      return
    case 'market': {
      const { enabled, ...write } = op.write
      const created = await createMarket(ctx, write)
      // A Shopify draft comes over switched off: shoppers see nothing until it is turned on.
      if (!enabled) await setMarketEnabled(ctx, { id: created.id, enabled: false })
      return
    }
    case 'shipping_profile': {
      const write = { name: op.name, productIds: op.productIds }
      const profile = op.id
        ? await updateShippingProfile(tx, storeId, op.id, write)
        : await createShippingProfile(tx, storeId, write)
      return saveMapping(tx, storeId, SETTINGS_MAPPINGS.shippingProfiles, op.sourceId, profile.id)
    }
    case 'zone': {
      // A custom profile's op runs before its zones, so its mapping is already saved.
      const profileId = op.profileSourceId
        ? await findMapping(tx, SETTINGS_MAPPINGS.shippingProfiles, op.profileSourceId)
        : null
      const zone = op.id
        ? await updateShippingZone(tx, storeId, op.id, op.write)
        : await createShippingZone(tx, storeId, { ...op.write, profileId })
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
    case 'purchase_order':
      return importPurchaseOrder(tx, storeId, op.write)
    case 'transfer':
      return importTransfer(tx, storeId, op.write)
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
