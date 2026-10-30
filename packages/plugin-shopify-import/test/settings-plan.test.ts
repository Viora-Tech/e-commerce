/**
 * Store settings: recorded Admin API answers → what the plan shows and writes. No
 * database: the planner is pure, and `applyToLocal` stands in for the writes so a
 * second plan proves a re-run changes nothing.
 */
import { POLICY_TITLES, POLICY_TYPES } from '@commerce/core/policies'
import { describe, expect, it } from 'vitest'
import { fetchSettingsSource, type SettingsSource } from '../src/api-settings'
import { SETTINGS_PARTS, type SettingsItem } from '../src/settings-client'
import {
  type LocalSettings,
  type PartPlan,
  planLocations,
  planStore,
  planTax,
  type SettingsOp,
} from '../src/settings-plan'
import { planFields, planPolicies } from '../src/settings-plan-content'
import { planSegments, segmentRules } from '../src/settings-plan-segments'
import { planShipping } from '../src/settings-plan-shipping'
import { ShopifyClient } from '../src/shopify-client'
import { settingsShopify } from './fixtures/settings'

const client = (deny: string[] = [], log: string[] = []) =>
  new ShopifyClient({
    shopDomain: 'waimers.myshopify.com',
    accessToken: 'shpat_test',
    fetch: settingsShopify(deny, log),
    sleep: async () => {},
  })

const read = (deny: string[] = []) => fetchSettingsSource(client(deny), SETTINGS_PARTS)

/** Rate ids are uuids: a write with any other id is refused by the zone schema. */
const RATE_ID = '0192f7a4-7d0e-7c3a-9b1e-2f4a5c6d7e8f'

function emptyLocal(): LocalSettings {
  return {
    profile: {
      name: 'my-store',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      contactEmail: '',
      contactPhone: '',
      address: { line1: '', line2: '', city: '', state: '', pincode: '', country: 'IN' },
      pricesIncludeGst: true,
      moneyFormat: null,
    },
    seo: { title: '', description: '' },
    defaultGstin: null,
    gstins: [],
    locations: [
      {
        id: 'loc-home',
        isDefault: true,
        name: 'Default location',
        line1: '',
        line2: '',
        city: '',
        stateCode: '',
        pincode: '',
        country: 'IN',
        phone: '',
      },
    ],
    zones: [],
    policies: POLICY_TYPES.map((type) => ({
      type,
      exists: false,
      title: POLICY_TITLES[type],
      body: null,
      published: false,
    })),
    fields: [],
    segments: [],
    mapped: { locations: new Map(), zones: new Map(), fields: new Map(), contentTypes: new Map() },
  }
}

/** The writes, done to the in-memory store the planner reads. */
function applyToLocal(local: LocalSettings, ops: SettingsOp[]): LocalSettings {
  const next = structuredClone(local)
  const maps = {
    settings_locations: new Map(local.mapped.locations),
    settings_shipping_zones: new Map(local.mapped.zones),
    metafield_definitions: new Map(local.mapped.fields),
  } as Record<string, Map<string, string>>
  let n = 0
  for (const op of ops) {
    if (op.kind === 'profile') {
      const set = Object.entries(op.patch).filter(([, v]) => v !== undefined)
      next.profile = { ...next.profile, ...Object.fromEntries(set) }
    }
    if (op.kind === 'gstin') {
      next.defaultGstin = op.gstin
      next.gstins.push(op.gstin)
    }
    if (op.kind === 'seo') {
      next.seo = {
        title: op.title ?? next.seo.title,
        description: op.description ?? next.seo.description,
      }
    }
    if (op.kind === 'segment') next.segments = [...next.segments, op.name]
    if (op.kind === 'location') {
      const id = op.id ?? `loc-${++n}`
      const at = next.locations.findIndex((l) => l.id === id)
      const row = {
        ...op.details,
        id,
        isDefault: at >= 0 ? Boolean(next.locations[at]?.isDefault) : false,
      }
      if (at >= 0) next.locations[at] = row
      else next.locations.push(row)
      if (op.sourceId) maps.settings_locations?.set(op.sourceId, id)
    }
    if (op.kind === 'zone') {
      const id = op.id ?? `zone-${++n}`
      const zone = {
        id,
        name: op.write.name,
        stateCodes: op.write.stateCodes,
        pincodeRules: op.write.pincodeRules,
        rates: op.write.rates.map((r, i) => ({
          id: r.id ?? `0192f7a4-7d0e-7c3a-9b1e-${String(n * 100 + i).padStart(12, '0')}`,
          name: r.name,
          condition: r.condition,
          minValue: r.minValue,
          maxValue: r.maxValue,
          pricePaise: r.pricePaise,
          freeAbovePaise: r.freeAbovePaise,
          codSurchargePaise: r.codSurchargePaise,
          minTransitDays: r.minTransitDays,
          maxTransitDays: r.maxTransitDays,
        })),
      }
      next.zones = [...next.zones.filter((z) => z.id !== id), zone]
      maps.settings_shipping_zones?.set(op.sourceId, id)
    }
    if (op.kind === 'policy') {
      next.policies = next.policies.map((p) =>
        p.type === op.type
          ? { type: p.type, exists: true, title: op.title, body: op.body, published: op.published }
          : p,
      )
    }
    if (op.kind === 'field') {
      const id = `field-${++n}`
      next.fields.push({
        id,
        ownerType: op.write.ownerType,
        namespace: op.write.namespace,
        key: op.write.key ?? '',
        type: op.write.type,
        list: op.write.list,
      })
      maps.metafield_definitions?.set(op.sourceId, id)
    }
    if (op.kind === 'map') maps[op.resource]?.set(op.sourceId, op.localId)
  }
  next.mapped = {
    locations: maps.settings_locations ?? new Map(),
    zones: maps.settings_shipping_zones ?? new Map(),
    fields: maps.metafield_definitions ?? new Map(),
    contentTypes: local.mapped.contentTypes,
  }
  return next
}

const changed = (plan: PartPlan) =>
  plan.items.filter((i) => i.action === 'create' || i.action === 'update')
const find = (items: SettingsItem[], match: Partial<SettingsItem>) =>
  items.find((i) => Object.entries(match).every(([k, v]) => i[k as keyof SettingsItem] === v))

function allPlans(source: SettingsSource, local: LocalSettings) {
  if (!source.locations?.ok || !source.profiles?.ok || !source.policies?.ok) throw new Error('read')
  const fields = (source.fields ?? []).flatMap((f) =>
    f.read.ok ? [{ owner: f.owner, definitions: f.read.data }] : [],
  )
  return [
    planStore(source.shop, local),
    planTax(source.shop, local),
    planLocations(source.locations.data, local),
    planShipping(source.profiles.data, source.locations.data, local),
    planPolicies(source.policies.data, local),
    planFields(fields, local),
  ]
}

describe('reading store settings from Shopify', () => {
  it('maps the shop, finds a GSTIN an app saved, and skips inactive locations', async () => {
    const source = await read()
    expect(source.shop).toMatchObject({
      name: 'Waimers',
      email: 'hello@waimers.in',
      currency: 'INR',
      taxesIncluded: true,
      gstin: '29AAGCB7383J1Z4',
      moneyFormat: 'Rs. {{amount}}',
    })
    expect(source.shop.address).toMatchObject({
      line1: '12 MG Road',
      province: 'Karnataka',
      zip: '560001',
    })
    expect(source.locations?.ok && source.locations.data.map((l) => l.name)).toEqual([
      'Bengaluru warehouse',
      'Delhi store',
      'Amazon MCF',
    ])
  })

  it('reads zones only for the general profile, with weights in grams and prices in paise', async () => {
    const log: string[] = []
    const source = await fetchSettingsSource(client([], log), ['shipping'])
    expect(log.filter((l) => l.startsWith('zones:'))).toEqual([
      'zones:gid://shopify/DeliveryProfile/1',
    ])
    const profiles = source.profiles?.ok ? source.profiles.data : []
    const light = profiles[0]?.zones[1]?.methods[0]
    expect(light).toMatchObject({
      price: { amount: 6000, currency: 'INR' },
      conditions: [{ field: 'weight', operator: 'max', grams: 500 }],
    })
    expect(profiles[1]).toMatchObject({ name: 'Heavy chairs', default: false, zones: [] })
  })

  it('turns a missing scope into "needs access" for that part only', async () => {
    const source = await read(['profiles', 'policies', 'fields:CUSTOMER'])
    expect(source.profiles).toMatchObject({ ok: false, access: true })
    expect(source.policies).toMatchObject({ ok: false, access: true })
    expect(source.locations?.ok).toBe(true)
    const customer = source.fields?.find((f) => f.owner.ours === 'customer')
    expect(customer?.read).toMatchObject({ ok: false, access: true })
    expect(source.fields?.find((f) => f.owner.ours === 'product')?.read.ok).toBe(true)
  })
})

describe('store details and tax', () => {
  it('brings over name, email, phone and address, and fills the default location', async () => {
    const source = await read()
    const plan = planStore(source.shop, emptyLocal())
    expect(find(plan.items, { subject: 'store_name' })).toMatchObject({
      action: 'update',
      to: 'Waimers',
    })
    expect(find(plan.items, { subject: 'contact_phone' })).toMatchObject({ to: '+919876543210' })
    expect(find(plan.items, { subject: 'address' })?.to).toBe(
      '12 MG Road, Floor 3, Bengaluru, Karnataka, 560001',
    )
    expect(find(plan.items, { subject: 'default_location_address' })).toMatchObject({
      action: 'update',
    })
    expect(plan.ops[0]).toMatchObject({
      kind: 'profile',
      patch: { name: 'Waimers', contactEmail: 'hello@waimers.in', moneyFormat: 'Rs. {{amount}}' },
    })
    expect(find(plan.items, { subject: 'money_format' })).toMatchObject({
      action: 'update',
      from: null,
      to: 'Rs. {{amount}}',
    })
    expect(plan.ops[1]).toMatchObject({
      kind: 'location',
      id: 'loc-home',
      details: { name: 'Default location', stateCode: 'KA', pincode: '560001' },
    })
  })

  it('brings over the home page title and description only where this store has none', async () => {
    const source = await read()
    expect(source.shop.seo).toEqual({
      title: 'Waimers',
      description: 'Premium gaming peripherals for India.',
    })
    const fresh = planStore(source.shop, emptyLocal())
    expect(find(fresh.items, { subject: 'home_seo_title' })).toMatchObject({
      action: 'update',
      to: 'Waimers',
    })
    expect(fresh.ops).toContainEqual({
      kind: 'seo',
      title: 'Waimers',
      description: 'Premium gaming peripherals for India.',
    })
    const written = planStore(source.shop, {
      ...emptyLocal(),
      seo: { title: 'Our own title', description: '' },
    })
    expect(find(written.items, { subject: 'home_seo_title' })).toMatchObject({ action: 'same' })
    expect(written.ops).toContainEqual({
      kind: 'seo',
      description: 'Premium gaming peripherals for India.',
    })
  })

  it('warns about currency, time zone and weight unit without changing them', async () => {
    const source = await read()
    const shop = {
      ...source.shop,
      currency: 'USD',
      timezone: 'America/New_York',
      weightUnit: 'POUNDS',
    }
    const plan = planStore(shop, emptyLocal())
    for (const subject of ['currency', 'timezone', 'weight_unit'] as const) {
      expect(find(plan.items, { subject })?.action).toBe('warn')
    }
    const patch = plan.ops.find((o) => o.kind === 'profile')
    expect(patch && 'patch' in patch ? Object.keys(patch.patch) : []).not.toContain('timezone')
  })

  it('adds the GSTIN only when the store has none, and never replaces one', async () => {
    const source = await read()
    const fresh = planTax({ ...source.shop, taxesIncluded: false }, emptyLocal())
    expect(find(fresh.items, { subject: 'gstin' })).toMatchObject({
      action: 'create',
      to: '29AAGCB7383J1Z4',
    })
    expect(find(fresh.items, { subject: 'prices_include_tax' })).toMatchObject({
      action: 'update',
      from: 'on',
      to: 'off',
    })

    const taken = { ...emptyLocal(), defaultGstin: '27AAGCB7383J1Z8', gstins: ['27AAGCB7383J1Z8'] }
    const conflict = planTax(source.shop, taken)
    expect(find(conflict.items, { subject: 'gstin' })).toMatchObject({
      action: 'conflict',
      reason: 'gstin_exists',
      from: '27AAGCB7383J1Z8',
    })
    expect(conflict.ops.some((o) => o.kind === 'gstin')).toBe(false)

    const hidden = planTax({ ...source.shop, gstin: null }, emptyLocal())
    expect(find(hidden.items, { subject: 'gstin' })).toMatchObject({
      action: 'manual',
      reason: 'gstin_not_shared',
    })
  })
})

describe('locations', () => {
  it('matches by name, gives the generic default location Shopify’s first one, and adds the rest', async () => {
    const source = await read()
    const data = source.locations?.ok ? source.locations.data : []
    const plan = planLocations(data, emptyLocal())
    expect(find(plan.items, { name: 'Bengaluru warehouse' })).toMatchObject({
      action: 'update',
      from: 'Default location',
    })
    expect(find(plan.items, { name: 'Delhi store', action: 'create' })).toBeTruthy()
    // "1100 01" is six digits once the space goes.
    expect(plan.ops.find((o) => o.kind === 'location' && o.id === null)).toMatchObject({
      details: { name: 'Delhi store', stateCode: 'DL', pincode: '110001' },
    })
    expect(find(plan.items, { name: 'Amazon MCF' })).toMatchObject({
      action: 'manual',
      reason: 'app_location',
    })
  })

  it('keeps a renamed default location and says which one ships first on Shopify', async () => {
    const source = await read()
    const data = source.locations?.ok ? source.locations.data : []
    const local = emptyLocal()
    const home = local.locations[0]
    if (home) home.name = 'Main godown'
    const plan = planLocations(data, local)
    expect(find(plan.items, { name: 'Bengaluru warehouse', action: 'create' })).toBeTruthy()
    expect(find(plan.items, { reason: 'default_location' })).toMatchObject({
      detail: 'Main godown',
    })
    expect(plan.ops.some((o) => o.kind === 'location' && o.id === 'loc-home')).toBe(false)
  })
})

describe('shipping', () => {
  it('maps flat, price-band, free-over and weight rates; lists what has to be set up by hand', async () => {
    const source = await read()
    const profiles = source.profiles?.ok ? source.profiles.data : []
    const locations = source.locations?.ok ? source.locations.data : null
    const plan = planShipping(profiles, locations, emptyLocal())
    const south = find(plan.items, { name: 'South India' })
    expect(south?.action).toBe('create')
    expect(south?.rates).toEqual([
      // Shopify's "up to ₹998.99" includes it; ours excludes the bound, so it moves up a paisa.
      { name: 'Standard', condition: 'order_value', min: null, max: 99900, pricePaise: 4900 },
      { name: 'Free shipping', condition: 'order_value', min: 99900, max: null, pricePaise: 0 },
    ])
    const southOp = plan.ops.find((o) => o.kind === 'zone' && o.write.name === 'South India')
    expect(southOp && southOp.kind === 'zone' ? southOp.write.stateCodes : []).toEqual([
      'KA',
      'KL',
      'TN',
    ])

    const rest = find(plan.items, {
      name: 'Rest of India',
      subject: 'shipping_zone',
      action: 'create',
    })
    expect(rest?.rates).toEqual([
      { name: 'Light', condition: 'weight', min: null, max: 501, pricePaise: 6000 },
      { name: 'Heavy', condition: 'weight', min: 500, max: null, pricePaise: 12000 },
    ])
    expect(find(plan.items, { name: 'Odd' })).toMatchObject({ reason: 'mixed_conditions' })
    expect(find(plan.items, { name: 'Shiprocket live' })).toMatchObject({
      reason: 'carrier_rates',
      detail: 'Shiprocket',
    })
    expect(find(plan.items, { name: 'International' })).toMatchObject({
      reason: 'zone_outside_india',
    })
    expect(find(plan.items, { name: 'Heavy chairs' })).toMatchObject({ reason: 'product_profile' })
    expect(find(plan.items, { name: 'Bengaluru warehouse' })).toMatchObject({
      reason: 'local_pickup',
    })
    expect(plan.items.some((i) => i.name === 'Old rate')).toBe(false)
  })

  it('keeps the merchant’s COD fee and delivery days on a rate it already has', async () => {
    const source = await read()
    const profiles = source.profiles?.ok ? source.profiles.data : []
    const local = emptyLocal()
    local.zones = [
      {
        id: 'zone-mine',
        name: 'south india',
        stateCodes: ['KA'],
        pincodeRules: [{ pattern: '560*', mode: 'include' }],
        rates: [
          {
            id: RATE_ID,
            name: 'Standard',
            condition: 'none',
            minValue: null,
            maxValue: null,
            pricePaise: 5900,
            freeAbovePaise: null,
            codSurchargePaise: 0,
            minTransitDays: 2,
            maxTransitDays: 4,
          },
        ],
      },
    ]
    const plan = planShipping(profiles, null, local)
    const op = plan.ops.find((o) => o.kind === 'zone' && o.id === 'zone-mine')
    expect(op && op.kind === 'zone' ? op.write : null).toMatchObject({
      name: 'south india',
      pincodeRules: [{ pattern: '560*', mode: 'include' }],
      rates: [
        { id: RATE_ID, pricePaise: 4900, codSurchargePaise: 0, minTransitDays: 2 },
        { name: 'Free shipping' },
      ],
    })
  })
})

describe('policies and extra fields', () => {
  it('sanitises policy HTML, leaves pictures out and names kinds with no page here', async () => {
    const source = await read()
    const plan = planPolicies(source.policies?.ok ? source.policies.data : [], emptyLocal())
    const refund = plan.ops.find((o) => o.kind === 'policy' && o.type === 'refund-policy')
    const text = JSON.stringify(refund && refund.kind === 'policy' ? refund.body : null)
    expect(text).toContain('7 days')
    expect(text).not.toContain('alert')
    expect(text).not.toContain('color:red')
    expect(text).not.toContain('cdn.shopify.com')
    expect(find(plan.items, { reason: 'policy_images' })).toMatchObject({ detail: '1' })
    expect(find(plan.items, { name: 'Legal notice' })).toMatchObject({ reason: 'policy_type' })
    // An empty Shopify policy is not brought over.
    expect(plan.ops.some((o) => o.kind === 'policy' && o.type === 'shipping-policy')).toBe(false)
    expect(plan.ops.filter((o) => o.kind === 'policy')).toHaveLength(3)
  })

  it('creates supported field definitions, lists the rest, and keeps a clashing one', async () => {
    const source = await read()
    const local = emptyLocal()
    local.fields = [
      {
        id: 'f-colour',
        ownerType: 'product',
        namespace: 'custom',
        key: 'colour',
        type: 'number_integer',
        list: false,
      },
    ]
    const plan = planFields(
      (source.fields ?? []).flatMap((f) =>
        f.read.ok ? [{ owner: f.owner, definitions: f.read.data }] : [],
      ),
      local,
    )
    expect(find(plan.items, { name: 'Warranty (months)' })).toMatchObject({
      action: 'create',
      owner: 'product',
    })
    expect(find(plan.items, { name: 'Price per kg' })).toMatchObject({
      action: 'manual',
      reason: 'field_type',
      detail: 'money',
    })
    expect(find(plan.items, { name: 'Colour' })).toMatchObject({
      action: 'conflict',
      reason: 'field_exists',
    })
    expect(plan.items.some((i) => i.name === 'SEO title')).toBe(false)
    const birthday = plan.ops.find((o) => o.kind === 'field' && o.write.ownerType === 'customer')
    expect(birthday && birthday.kind === 'field' ? birthday.write : null).toMatchObject({
      key: 'birthday',
      type: 'date',
      storefrontAccess: false,
    })
    expect(plan.ops.find((o) => o.kind === 'field' && o.write.ownerType === 'variant')).toBeTruthy()
  })
})

describe('running it again', () => {
  it('changes nothing the second time', async () => {
    const source = await read()
    const first = emptyLocal()
    const plans = allPlans(source, first)
    expect(plans.every((p) => changed(p).length > 0)).toBe(true)
    const after = applyToLocal(
      first,
      plans.flatMap((p) => p.ops),
    )
    const again = allPlans(source, after)
    expect(again.flatMap(changed)).toEqual([])
    const sameLines = again.flatMap((p) => p.items.filter((i) => i.action === 'same'))
    expect(sameLines.filter((i) => i.subject === 'shipping_zone').map((i) => i.name)).toEqual([
      'South India',
      'Rest of India',
    ])
    expect(sameLines.filter((i) => i.subject === 'location')).toHaveLength(2)
    expect(sameLines.filter((i) => i.subject === 'policy')).toHaveLength(3)
    expect(sameLines.filter((i) => i.subject === 'field')).toHaveLength(4)
    // Matches are remembered, so a later rename on either side keeps them paired.
    expect(after.mapped.locations.size).toBe(2)
    expect(after.mapped.zones.size).toBe(2)
  })
})

describe('customer segments (audit #87)', () => {
  it('turns Shopify segment queries into our conditions', () => {
    expect(segmentRules("customer_tags CONTAINS 'vip' AND number_of_orders >= 2")).toEqual({
      match: 'all',
      conditions: [
        { field: 'tag', op: 'contains', value: 'vip' },
        { field: 'orders', op: 'gte', value: '2' },
      ],
    })
    expect(segmentRules('amount_spent > 1000 OR last_order_date > -30d')).toEqual({
      match: 'any',
      conditions: [
        { field: 'spend', op: 'gte', value: '100001' },
        { field: 'last_order_days', op: 'lte', value: '30' },
      ],
    })
    expect(segmentRules("email_subscription_status != 'SUBSCRIBED'")?.conditions).toEqual([
      { field: 'marketing', op: 'eq', value: 'false' },
    ])
    // A filter we cannot express, or AND mixed with OR: left for the merchant, never half-imported.
    expect(segmentRules("customer_cities CONTAINS 'IN-HR-Sonipat'")).toBeNull()
    expect(
      segmentRules("customer_tags CONTAINS 'a' AND number_of_orders >= 1 OR amount_spent > 5"),
    ).toBeNull()
  })

  it('creates the ones it can, keeps same-named ones, lists the rest', async () => {
    const source = await read()
    expect(source.segments?.ok).toBe(true)
    const plan = planSegments(source.segments?.ok ? source.segments.data : [], {
      ...emptyLocal(),
      segments: ['Email subscribers'],
    })
    expect(plan.items.map((i) => [i.name, i.action])).toEqual([
      ['Restock list: Mio', 'create'],
      ['Email subscribers', 'same'],
      ['Bought TenZ', 'manual'],
    ])
    expect(plan.ops).toEqual([
      {
        kind: 'segment',
        name: 'Restock list: Mio',
        rules: {
          match: 'all',
          conditions: [{ field: 'tag', op: 'contains', value: 'restock-dysphoria-mio' }],
        },
      },
    ])
  })
})
