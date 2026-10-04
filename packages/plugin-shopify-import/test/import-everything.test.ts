import {
  collection,
  customer,
  discount,
  giftCard,
  media,
  metafield,
  metafieldDefinition,
  metaobject,
  metaobjectDefinition,
  product,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mapFile } from '../src/api-files'
import type { ResourceProgress } from '../src/client'
import { connect } from '../src/connection'
import { mapShopifyType, parseShopifyValue, shopifyRichText } from '../src/field-values'
import { executeRun } from '../src/run'
import { importIssue, importRun } from '../src/schema'
import { createApiRun, startRun } from '../src/service'
import { refusal } from '../src/write-discounts'
import {
  COLLECTION_METAFIELDS,
  DISCOUNTS,
  FILES,
  giftCards,
  METAFIELD_DEFINITIONS,
  METAOBJECT_DEFINITIONS,
  METAOBJECTS,
  PRODUCT_METAFIELDS,
} from './fixtures/everything'
import { COLLECTIONS, CUSTOMERS, PRODUCT_PAGES, VARIANT_PAGES } from './fixtures/graphql'
import {
  app,
  deps,
  type FetchLog,
  fakeFetch,
  json,
  MemoryStorageProvider,
  owner,
  SECRET,
  seedStore,
} from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const cost = {
  requestedQueryCost: 50,
  throttleStatus: { maximumAvailable: 2000, currentlyAvailable: 1900, restoreRate: 100 },
}

/** The fake Admin API for every resource; `state` lets a test change answers between runs. */
function shopifyFor(state: { giftCardBalance: string; denyGiftCards?: boolean }) {
  return (query: string, variables: Record<string, unknown>): Response => {
    const cursor = (variables.cursor as string | null) ?? 'first'
    const op = /query (\w+)/.exec(query)?.[1] ?? 'Shop'
    if (op === 'GiftCards' && state.denyGiftCards) {
      return json({
        errors: [
          { message: 'Access denied for giftCards field.', extensions: { code: 'ACCESS_DENIED' } },
        ],
      })
    }
    const ownerType = variables.ownerType as string | undefined
    const data: Record<string, unknown> = {
      Shop: { shop: { name: 'Waimers', myshopifyDomain: 'waimers.myshopify.com' } },
      Products: PRODUCT_PAGES[cursor],
      Variants: VARIANT_PAGES[cursor],
      Collections: COLLECTIONS,
      Customers: CUSTOMERS,
      Files: FILES,
      MetaobjectDefinitions: METAOBJECT_DEFINITIONS,
      Metaobjects: METAOBJECTS[variables.type as string],
      MetafieldDefinitions: METAFIELD_DEFINITIONS[ownerType ?? ''] ?? {
        metafieldDefinitions: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
      },
      OwnerMetafields: query.includes('collections(') ? COLLECTION_METAFIELDS : PRODUCT_METAFIELDS,
      Discounts: DISCOUNTS,
      GiftCards: giftCards(state.giftCardBalance),
    }
    return json({ data: data[op], extensions: { cost } })
  }
}

/** Images answer as PNG (helpers); mp4 links answer as a tiny mp4. */
function withVideo(inner: typeof fetch): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('.mp4')) {
      const bytes = new Uint8Array(32)
      bytes.set([0, 0, 0, 32, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], 0)
      return new Response(bytes, { headers: { 'content-type': 'video/mp4' } })
    }
    return inner(input, init)
  }) as typeof fetch
}

const EVERYTHING = [
  'products',
  'collections',
  'customers',
  'files',
  'metaobjects',
  'metafields',
  'discounts',
  'gift_cards',
] as const

async function setup(state: { giftCardBalance: string; denyGiftCards?: boolean }) {
  const log: FetchLog = []
  const fetchImpl = withVideo(fakeFetch(shopifyFor(state), log))
  const storeId = await seedStore()
  await withStore(app, storeId, (tx) =>
    connect(
      tx,
      storeId,
      { shopDomain: 'waimers.myshopify.com', accessToken: 'shpat_0123456789abcdef' },
      SECRET,
      fetchImpl,
    ),
  )
  const d = deps(storeId, new MemoryStorageProvider(), { fetch: fetchImpl, sleep: async () => {} })
  const run = await withStore(app, storeId, (tx) =>
    createApiRun(tx, storeId, { resources: [...EVERYTHING], createdBy: null }),
  )
  return { storeId, d, runId: run.id, log }
}

async function progressOf(runId: string) {
  const [row] = await owner.select().from(importRun).where(eq(importRun.id, runId))
  return row
}

const left = (p: ResourceProgress | undefined) =>
  Object.fromEntries(
    (p?.left ?? []).map((l) => [`${l.reason}${l.detail ? `:${l.detail}` : ''}`, l.count]),
  )

describe('field types and values', () => {
  it('maps Shopify types onto ours and says which have no match', () => {
    expect(mapShopifyType('single_line_text_field')).toEqual({
      ok: true,
      type: 'single_line_text',
      list: false,
    })
    expect(mapShopifyType('list.product_reference')).toEqual({
      ok: true,
      type: 'product_reference',
      list: true,
    })
    expect(mapShopifyType('date_time')).toMatchObject({
      ok: true,
      type: 'date',
      lossy: 'time_dropped',
    })
    expect(mapShopifyType('money')).toEqual({ ok: false, shopifyType: 'money' })
    expect(mapShopifyType('list.rich_text_field')).toEqual({
      ok: false,
      shopifyType: 'list.rich_text_field',
    })
  })

  it('reads values: lists, links, dates with time, and Shopify rich text', () => {
    const list = mapShopifyType('list.single_line_text_field')
    if (!list.ok) throw new Error('mapped')
    expect(parseShopifyValue(list, 'list.single_line_text_field', '["a","b"]')).toEqual(['a', 'b'])
    const link = mapShopifyType('link')
    if (!link.ok) throw new Error('mapped')
    expect(parseShopifyValue(link, 'link', '{"text":"Shop","url":"https://x.in"}')).toBe(
      'https://x.in',
    )
    const doc = shopifyRichText(
      JSON.stringify({
        type: 'root',
        children: [{ type: 'paragraph', children: [{ type: 'text', value: '<b>&', bold: true }] }],
      }),
    )
    expect(JSON.stringify(doc)).toContain('<b>&')
  })

  it('picks the largest mp4 under the video limit', () => {
    const f = mapFile(FILES.files.nodes[2] as Parameters<typeof mapFile>[0])
    expect(f).toMatchObject({ kind: 'video', url: 'https://cdn.shopify.com/videos/hero-720.mp4' })
  })

  it('refuses discounts our model cannot express, with the reason', () => {
    const base = {
      sourceId: 'x',
      title: 'X',
      kind: 'code' as const,
      typename: 'DiscountCodeBasic',
      codes: [],
      method: 'percent' as const,
      value: 1000,
      appliesOnEachItem: false,
      items: { kind: 'all' as const },
      minSubtotalPaise: null,
      minQuantity: null,
      allCustomers: true,
      countries: 'all' as const,
      maxShippingPaise: null,
      usageLimit: null,
      oncePerCustomer: false,
      used: 0,
      startsAt: null,
      endsAt: null,
    }
    expect(refusal(base)).toBeNull()
    expect(refusal({ ...base, minQuantity: 3 })?.reason).toBe('minimum_quantity')
    expect(refusal({ ...base, appliesOnEachItem: true })?.reason).toBe('per_item_amount')
    expect(refusal({ ...base, method: 'free_shipping', countries: ['IN', 'US'] })?.reason).toBe(
      'shipping_rules',
    )
    expect(refusal({ ...base, method: 'free_shipping', countries: ['IN'] })).toBeNull()
  })
})

describe('import everything', () => {
  it('previews, imports files, content types, extra fields, discounts and gift cards, and re-runs without duplicates', async () => {
    const state = { giftCardBalance: '500.00' }
    const { storeId, d, runId, log } = await setup(state)

    // Preview: counts and what stays behind, nothing written, nothing downloaded.
    await executeRun(d, runId)
    const preview = await progressOf(runId)
    expect(preview?.status).toBe('completed')
    const p = preview?.progress ?? {}
    expect(p.files).toMatchObject({ total: 5, created: 2, skipped: 3 })
    expect(left(p.files)).toEqual({ 'file_type:PDF': 1, external_video: 1, file_not_ready: 1 })
    expect(p.metaobjects).toMatchObject({ total: 4, created: 4 })
    expect(left(p.metaobjects)).toEqual({ 'field_type:money': 1, time_dropped: 1 })
    expect(left(p.metafields)).toMatchObject({
      'field_type:rating': 1,
      'metafield_owner:CUSTOMER': 40,
      'metafield_owner:PRODUCTVARIANT': 12,
    })
    expect(p.discounts).toMatchObject({ total: 7, created: 4, skipped: 3 })
    expect(left(p.discounts)).toEqual({
      buy_x_get_y: 1,
      code_characters: 1,
      customer_specific: 1,
    })
    expect(p.gift_cards).toMatchObject({ total: 4, created: 1, skipped: 3 })
    expect(left(p.gift_cards)).toEqual({
      gift_card_code: 1,
      gift_card_no_customer: 1,
      gift_card_empty: 2,
    })
    expect(await owner.select().from(metaobject)).toHaveLength(0)
    expect(await owner.select().from(discount)).toHaveLength(0)
    expect(await owner.select().from(giftCard)).toHaveLength(0)
    expect(log.some((l) => l.url.includes('cdn.shopify.com/files'))).toBe(false)

    // Import for real.
    await withStore(app, storeId, (tx) => startRun(tx, runId))
    await executeRun(d, runId)
    const done = await progressOf(runId)
    expect(done?.status).toBe('completed')
    expect(done?.error).toBeNull()

    // Files: the banner and the 720p mp4, nothing else.
    const files = await owner.select().from(media)
    const banner = files.find((m) => m.alt === 'Festive banner')
    expect(banner?.contentType).toBe('image/png')
    expect(files.some((m) => m.contentType === 'video/mp4')).toBe(true)
    expect(log.some((l) => l.url.endsWith('hero-1080.mp4') || l.url.endsWith('.pdf'))).toBe(false)

    // Content types: handles made ours, money left out, links resolved in the second pass.
    const defs = await owner
      .select()
      .from(metaobjectDefinition)
      .orderBy(asc(metaobjectDefinition.type))
    expect(defs.map((x) => x.type)).toEqual(['designer', 'size_chart'])
    const sizeChart = defs[1]
    expect(sizeChart?.fields.map((f) => [f.key, f.type, f.list])).toEqual([
      ['title', 'single_line_text', false],
      ['chart', 'file', false],
      ['notes', 'rich_text', false],
      ['related', 'metaobject_reference', true],
      ['product', 'product_reference', false],
    ])
    expect(sizeChart?.fields[3]?.validations?.metaobjectDefinitionId).toBe(defs[0]?.id)
    expect(defs[0]?.storefrontAccess).toBe(false)
    const entries = await owner.select().from(metaobject).orderBy(asc(metaobject.handle))
    const [asha, tees] = entries
    expect(asha).toMatchObject({ handle: 'asha', status: 'draft' })
    expect(asha?.fields).toMatchObject({ name: 'Asha', born: '1990-04-05' })
    const [aria] = await owner.select().from(product).where(eq(product.handle, 'aria-headset'))
    expect(tees?.fields).toMatchObject({
      title: 'Tees',
      chart: banner?.id,
      related: [asha?.id],
      product: aria?.id,
    })
    expect(JSON.stringify(tees?.fields.notes)).toContain('Chest')

    // Extra fields on products and collections.
    const mfDefs = await owner.select().from(metafieldDefinition)
    expect(mfDefs.map((x) => `${x.ownerType}:${x.namespace}.${x.key}:${x.type}`).sort()).toEqual([
      'collection:custom.banner:file',
      'product:custom.care:rich_text',
      'product:custom.launch:date',
      'product:custom.material:single_line_text',
      'product:custom.size_guide:metaobject_reference',
    ])
    const values = await owner.select().from(metafield)
    const storedValue = (key: string, ownerId: string | undefined) =>
      values.find(
        (v) => v.ownerId === ownerId && mfDefs.find((x) => x.id === v.definitionId)?.key === key,
      )?.value
    expect(storedValue('material', aria?.id)).toBe('Cotton')
    expect(storedValue('size_guide', aria?.id)).toBe(tees?.id)
    expect(storedValue('launch', aria?.id)).toBe('2026-10-01')
    const [keycaps] = await owner.select().from(product).where(eq(product.handle, 'keycaps'))
    expect(storedValue('material', keycaps?.id)).toBeUndefined()
    const [picks] = await owner
      .select()
      .from(collection)
      .where(eq(collection.handle, 'staff-picks'))
    expect(storedValue('banner', picks?.id)).toBe(banner?.id)

    // Discounts: four we can express, one per code.
    const discounts = await owner.select().from(discount).orderBy(asc(discount.title))
    expect(discounts.map((x) => [x.kind, x.code, x.method, x.value, x.appliesTo])).toEqual([
      ['automatic', null, 'fixed', 20000, 'collections'],
      ['code', 'SHIPFREE', 'free_shipping', 0, 'all'],
      ['code', 'VIP-A', 'percent', 1500, 'products'],
      ['code', 'WELCOME10', 'percent', 1000, 'all'],
    ])
    const welcome = discounts[3]
    expect(welcome).toMatchObject({
      minSubtotalPaise: 99900,
      usageLimit: 100,
      usagePerCustomer: 1,
      usedCount: 4,
    })
    expect(discounts[2]?.appliesToIds).toEqual([keycaps?.id])

    // Gift cards: one new code for Meera, nothing invented for the rest.
    const cards = await owner.select().from(giftCard)
    expect(cards).toHaveLength(1)
    const [meera] = await owner.select().from(customer)
    expect(cards[0]).toMatchObject({
      balancePaise: 50000,
      initialValuePaise: 50000,
      customerId: meera?.id,
      deliveredAt: null,
    })
    expect(cards[0]?.lastCharacters).not.toBe('AB12')
    expect(cards[0]?.note).toContain('ending ab12')
    const issues = await owner.select().from(importIssue).where(eq(importIssue.runId, runId))
    expect(issues.some((i) => i.resource === 'gift_cards' && i.ref === '•••• cd34')).toBe(true)
    expect(
      issues.some((i) => i.resource === 'metafields' && i.message.includes('Cotton, Linen')),
    ).toBe(true)

    // Run again with a smaller balance: updates in place, no duplicates.
    state.giftCardBalance = '400.00'
    await withStore(app, storeId, (tx) => startRun(tx, runId))
    await executeRun(d, runId)
    const again = await progressOf(runId)
    expect(again?.status).toBe('completed')
    expect(again?.progress.discounts).toMatchObject({ created: 0, updated: 4 })
    expect(again?.progress.metaobjects).toMatchObject({ created: 0, updated: 4 })
    expect(await owner.select().from(metaobject)).toHaveLength(2)
    expect(await owner.select().from(metafieldDefinition)).toHaveLength(5)
    expect(await owner.select().from(discount)).toHaveLength(4)
    expect(await owner.select().from(media)).toHaveLength(files.length)
    const [card] = await owner.select().from(giftCard)
    expect(await owner.select().from(giftCard)).toHaveLength(1)
    expect(card?.balancePaise).toBe(40000)
  })

  it('carries on when Shopify refuses one scope, and says which one to add', async () => {
    const { storeId, d, runId } = await setup({ giftCardBalance: '500.00', denyGiftCards: true })
    await executeRun(d, runId)
    await withStore(app, storeId, (tx) => startRun(tx, runId))
    await executeRun(d, runId)
    const run = await progressOf(runId)
    expect(run?.status).toBe('completed')
    expect(run?.progress.discounts?.created).toBe(4)
    const issues = await owner.select().from(importIssue).where(eq(importIssue.runId, runId))
    expect(issues.find((i) => i.resource === 'gift_cards')?.message).toContain('read_gift_cards')
  })
})
