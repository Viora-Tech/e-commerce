import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createMerchantAuth } from '@commerce/auth'
import { createMemoryRateLimitStore } from '@commerce/core'
import { authSchema, createDb, type StoreTx, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { seedEveryTable } from '@commerce/db/test/seed'
import { call } from '@orpc/server'
import { sql } from 'drizzle-orm'
import { strFromU8, unzipSync } from 'fflate'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'
import { type PickId, sampleInput, uuidsIn } from './support/sample-input'

/**
 * GUARDRAIL: cross-store leak test (docs/guardrails.md, "Cross-store leak test").
 *
 * Two stores, A and B, each with rows in EVERY table that has a `store_id` (the generic
 * seeder reads the schema, so new tables are covered without touching this file). Then,
 * signed in as store A's owner, it walks the WHOLE oRPC router and the storefront's data
 * loaders, calling each one twice: once with store A's own ids, once with store B's ids
 * as a probe. It fails if:
 *
 *   1. any response contains an id, or a seeded value, that belongs to store B (other than
 *      an id the call itself was given, which a "not found" may echo);
 *   2. any of store B's rows changed (A wrote to B);
 *   3. any of store A's rows now holds one of store B's ids (A linked B's data into its own).
 *
 * Procedures that would reach an outside service (gateways, couriers, SES, Shopify, DNS)
 * are listed in SKIP with a reason; everything else is called. A new procedure is covered
 * the day it is added to the router.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

/** Never call outside services from tests: these reach a gateway, courier, mailer, Shopify or DNS. */
const SKIP: Record<string, string> = {
  'store.estimateDelivery': 'courier serviceability API',
  'store.verifyShipping': 'courier API',
  'store.testDelhiveryConnection': 'courier API',
  'store.testShiprocketConnection': 'courier API',
  'store.testRapidshypConnection': 'courier API',
  'store.testXpressbeesConnection': 'courier API',
  'store.testEkartConnection': 'courier API',
  'store.testShadowfaxConnection': 'courier API',
  'store.testDecentroConnection': 'payment gateway API',
  'store.verifyStorage': 'storage bucket API',
  'store.testStorageConnection': 'storage bucket API',
  'store.migrateStorage': 'storage bucket API',
  'orders.createShipment': 'courier API',
  'orders.refreshTracking': 'courier API',
  'orders.cancelShipment': 'courier API',
  'returns.arrangePickup': 'courier API',
  'shipments.bulkBook': 'courier API',
  'shipments.quote': 'courier API',
  'shipments.schedulePickup': 'courier API',
  'shipments.createManifest': 'courier API',
  'shipments.ndrAction': 'courier API',
  'shipments.refreshWallet': 'courier API',
  'apps.testConnection': 'courier and payment gateway API',
  'payments.connect': 'payment gateway API',
  'payments.testConnection': 'payment gateway API',
  'payments.testOrderLink': 'payment gateway API',
  'payments.fixWebhook': 'payment gateway API',
  'payments.razorpayOAuthStart': 'payment gateway OAuth',
  'payments.razorpayOAuthComplete': 'payment gateway OAuth',
  'notifications.sendTest': 'sends a real message',
  'notifications.setSenderEmail': 'Amazon SES',
  'notifications.checkSenderEmail': 'Amazon SES',
  'notifications.removeSenderEmail': 'Amazon SES',
  'marketing.campaigns.testSend': 'sends a real message',
  'marketing.campaigns.whatsappTemplates': 'WhatsApp API',
  'giftCards.resend': 'sends a real message',
  'shopifyImport.connect': 'Shopify API',
  'shopifyImport.testConnection': 'Shopify API',
  'shopifyImport.createApiRun': 'Shopify API',
  'shopifyImport.preflight': 'Shopify API',
  'shopifyImport.status': 'Shopify API',
  'shopifyImport.settingsPreview': 'Shopify API',
  'shopifyImport.importSettings': 'Shopify API',
  'searchConsole.connectStart': 'Google OAuth',
  'searchConsole.connectComplete': 'Google OAuth',
  'searchConsole.disconnect': 'revokes the token at Google',
  'searchConsole.properties': 'Google Search Console API',
  'searchConsole.chooseProperty': 'Google Search Console API',
  'searchConsole.refresh': 'Google Search Console API',
  'searchConsole.sitemaps': 'Google Search Console API',
  'searchConsole.submitSitemap': 'Google Search Console API',
  'ai.writeProduct': 'AI model provider (a dev .env key would reach the real gateway)',
  'ai.suggestKeywords': 'AI model provider (a dev .env key would reach the real gateway)',
  'ai.assistant': 'AI model provider (a dev .env key would reach the real gateway)',
  'reviews.writeReply': 'AI model provider (a dev .env key would reach the real gateway)',
  'ai.bulkWrite':
    'AI model provider (runs in the request without a queue); covered by ai-assistant.test.ts',
  'purchaseDocuments.read':
    'AI model provider (reads in the request without a queue); covered by purchase-documents.test.ts',
  'domains.connect': 'DNS and certificate provider',
  'domains.verify': 'DNS and certificate provider',
  'onboarding.create': 'creates another store and switches the session to it',
  'invitations.accept': 'switches the session to another store',
  'staff.removeMember': 'can remove the caller from the store mid-walk',
  'staff.setMemberRole': 'can demote the caller mid-walk',
  'storeData.deleteStore':
    'deletes the store under test (the walk renames it first); covered by store-data.test.ts',
}

const sent: { email: string; otp: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})

type StoreUnderTest = {
  headers: Headers
  storeId: string
  organizationId: string
  ids: Map<string, string[]>
  productHandle: string
  collectionHandle: string
  mediaUrl: string
}

async function merchant(email: string, slug: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  const organizationId = org?.id as string
  await auth.api.setActiveOrganization({ headers, body: { organizationId } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: `Store ${slug}`, organizationId })
    .returning()
  if (!s) throw new Error('seed')
  // Seeded rows that point at a user point at a stand-in, never the signed-in owner, so
  // the owner's own membership is resolved by the API as it is for a real store.
  const standIn = `stand-in-${slug}`
  await owner
    .insert(authSchema.user)
    .values({ id: standIn, name: standIn, email: `${standIn}@example.test` })
  const seeded = await seedEveryTable(owner, s.id, {
    globals: { user: standIn, organization: organizationId },
    rowsPerTable: 2,
  })
  expect(seeded.failed, `seeder could not fill: ${JSON.stringify(seeded.failed)}`).toEqual([])
  await owner.execute(sql`update product set status = 'active' where store_id = ${s.id}`)
  return { headers, storeId: s.id, organizationId }
}

/** Store tables (those with `store_id`), read from the catalogue. */
async function storeTables(): Promise<{ name: string; hasId: boolean }[]> {
  return owner.execute<{ name: string; hasId: boolean }>(sql`
    select c.relname as name,
           exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'id' and not a.attisdropped) as "hasId"
    from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where c.relkind = 'r' and exists (
      select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'store_id' and not a.attisdropped
    )
    order by 1`)
}

async function idsOf(storeId: string): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  for (const t of await storeTables()) {
    if (!t.hasId) continue
    const rows = await owner.execute<{ id: string }>(
      sql`select id::text as id from ${sql.identifier(t.name)} where store_id = ${storeId} order by 1`,
    )
    out.set(
      t.name,
      rows.map((r) => r.id),
    )
  }
  return out
}

/** Every row of a store as text, table by table, in a stable order. */
async function dumpStore(storeId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const t of await storeTables()) {
    const rows = await owner.execute<{ j: string }>(
      sql`select row_to_json(t)::text as j from ${sql.identifier(t.name)} t where store_id = ${storeId}`,
    )
    out[t.name] = rows
      .map((r) => r.j)
      .sort()
      .join('\n')
  }
  return out
}

/** Seeded values (`s` + 12 hex, emails built from them) found in one store's rows. */
function seededTokens(dump: Record<string, string>): Set<string> {
  const out = new Set<string>()
  for (const text of Object.values(dump)) {
    for (const m of text.matchAll(/"(s[0-9a-f]{12})(@example\.test)?"/g)) out.add(m[1] as string)
  }
  return out
}

async function firstValue(table: string, column: string, storeId: string): Promise<string> {
  const [row] = await owner.execute<{ v: string }>(
    sql`select ${sql.identifier(column)}::text as v from ${sql.identifier(table)} where store_id = ${storeId} order by 1 limit 1`,
  )
  return row?.v ?? ''
}

async function storeUnderTest(email: string, slug: string): Promise<StoreUnderTest> {
  const m = await merchant(email, slug)
  return {
    ...m,
    ids: await idsOf(m.storeId),
    productHandle: await firstValue('product', 'handle', m.storeId),
    collectionHandle: await firstValue('collection', 'handle', m.storeId),
    mediaUrl: await firstValue('media', 'url', m.storeId),
  }
}

// --- which table an id field means ------------------------------------------------------

/** Router namespaces whose plain `id` / `ids` is a row of this table. Longest prefix wins. */
const NAMESPACE_TABLE: Record<string, string> = {
  products: 'product',
  collections: 'collection',
  inventory: 'location',
  purchaseOrders: 'purchase_order',
  transfers: 'transfer',
  pages: 'page',
  blog: 'article',
  metaobjects: 'metaobject',
  navigation: 'navigation_menu',
  redirects: 'url_redirect',
  orders: 'order',
  returns: 'return_request',
  shipments: 'shipment',
  'shipping.zones': 'shipping_zone',
  customerPrivacy: 'data_request',
  customers: 'customer',
  discounts: 'discount',
  'marketing.automations': 'marketing_automation',
  'marketing.campaigns': 'marketing_campaign',
  giftCards: 'gift_card',
  gstInvoices: 'invoice',
  'gstInvoices.periods': 'invoice_period',
  shopifyImport: 'shopify_import_run',
  media: 'media',
  staff: 'role',
  domains: 'store_domain',
  themes: 'theme',
  'themes.templates': 'theme_template',
  'themes.versions': 'theme_version',
  storeData: 'store_export',
  'backInStock.signups': 'back_in_stock_signup',
}

/** Procedure-name hints that beat the namespace (`blog.updateBlog` edits a blog, not an article). */
const NAME_HINTS: [RegExp, string][] = [
  [/^(approve|revise|cancel|undo)Action$/, 'ai_action'],
  [/^(bulkJob|cancelBulk|applyBulk)$/, 'ai_job'],
  [/MetafieldDefinition/, 'metafield_definition'],
  [/Definition/, 'metaobject_definition'],
  [/Blog$/, 'blog'],
  [/[Ss]egment/, 'customer_segment'],
  [/Address/, 'customer_address'],
  [/Role$/, 'role'],
  [/Location$/, 'location'],
]

/** Id fields whose table is set by the procedure, not by the field name alone. */
const PROCEDURE_KEY_TABLE: Record<string, string> = {
  'purchaseOrders.receive.lineId': 'purchase_order_line',
  'themes.code.version.versionId': 'theme_file_version',
}

const KEY_ALIAS: Record<string, string> = {
  orderLineId: 'order_line',
  lineId: 'order_line',
  returnId: 'return_request',
  returnRequestId: 'return_request',
  segmentId: 'customer_segment',
  campaignId: 'marketing_campaign',
  automationId: 'marketing_automation',
  definitionId: 'metaobject_definition',
  zoneId: 'shipping_zone',
  menuId: 'navigation_menu',
  requestId: 'data_request',
  runId: 'shopify_import_run',
  templateId: 'theme_template',
  pickupId: 'shipment_pickup',
  manifestId: 'shipment_manifest',
  exportId: 'store_export',
  fromLocationId: 'location',
  toLocationId: 'location',
  addressId: 'customer_address',
  articleId: 'article',
  periodId: 'invoice_period',
}

const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

function tableFor(key: string, path: string[], tables: Set<string>): string {
  const byProcedure = PROCEDURE_KEY_TABLE[`${path.join('.')}.${key}`]
  if (byProcedure) return byProcedure
  if (KEY_ALIAS[key]) return KEY_ALIAS[key]
  const m = key.match(/^(.+?)Ids?$/)
  if (m?.[1] && tables.has(snake(m[1]))) return snake(m[1])
  const name = path.at(-1) ?? ''
  for (const [re, table] of NAME_HINTS) if (re.test(name)) return table
  for (let i = path.length - 1; i > 0; i--) {
    const table = NAMESPACE_TABLE[path.slice(0, i).join('.')]
    if (table) return table
  }
  return 'product'
}

function picker(target: StoreUnderTest, path: string[], tables: Set<string>): PickId {
  return (key) => {
    const ids = target.ids.get(tableFor(key, path, tables)) ?? target.ids.get('product') ?? []
    return ids[0]
  }
}

// --- reading a response -----------------------------------------------------------------

async function textOf(value: unknown): Promise<string> {
  if (value instanceof Blob) {
    const bytes = new Uint8Array(await value.arrayBuffer())
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      try {
        return Object.values(unzipSync(bytes))
          .map((f) => strFromU8(f))
          .join('\n')
      } catch {
        // not a zip after all
      }
    }
    return Buffer.from(bytes).toString('latin1')
  }
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === 'bigint') return v.toString()
    if (v instanceof Map) return [...v.entries()]
    if (v instanceof Set) return [...v]
    return v
  })
}

type Procedure = { path: string[]; proc: unknown }

function procedures(node: unknown, path: string[] = [], out: Procedure[] = []): Procedure[] {
  if (node && typeof node === 'object' && '~orpc' in node) {
    out.push({ path, proc: node })
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) procedures(v, [...path, k], out)
  }
  return out
}

const inputSchemaOf = (proc: unknown) =>
  (proc as { '~orpc': { inputSchema?: unknown } })['~orpc'].inputSchema

// --- the test ---------------------------------------------------------------------------

let a: StoreUnderTest
let b: StoreUnderTest
let bForbidden: Set<string>
let bBefore: Record<string, string>
const findings: string[] = []

beforeAll(async () => {
  process.env.LOCAL_STORAGE_DIR = mkdtempSync(join(tmpdir(), 'leak-test-uploads-'))
  await resetDb(owner)
  a = await storeUnderTest('leak-a@example.com', 'leak-a')
  b = await storeUnderTest('leak-b@example.com', 'leak-b')
  bBefore = await dumpStore(b.storeId)
  bForbidden = new Set([
    b.storeId,
    b.organizationId,
    ...[...b.ids.values()].flat(),
    ...seededTokens(bBefore),
  ])
}, 120_000)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

function leaksIn(text: string, given: Set<string>): string[] {
  const hits: string[] = []
  for (const value of bForbidden) {
    if (given.has(value)) continue
    if (text.includes(value)) hits.push(value)
  }
  return hits
}

describe('cross-store leak guardrail', () => {
  it('the detector itself catches a planted leak (so a pass means something)', async () => {
    const bProduct = b.ids.get('product')?.[0] as string
    const bToken = [...bForbidden].find((v) => /^s[0-9a-f]{12}$/.test(v)) as string
    const planted = await textOf({ items: [{ id: 'x', title: bToken }, { id: bProduct }] })
    expect(leaksIn(planted, new Set())).toEqual(expect.arrayContaining([bProduct, bToken]))
    // An id the call was given may be echoed back ("not found: <id>") without counting.
    expect(leaksIn(`Product ${bProduct} not found`, new Set([bProduct]))).toEqual([])
    // Store A's own data is never flagged.
    const aProduct = a.ids.get('product')?.[0] as string
    expect(leaksIn(JSON.stringify({ id: aProduct, storeId: a.storeId }), new Set())).toEqual([])
  })

  // Runs first: the router walk below may delete store A's own rows.
  it('no storefront data loader shows store A anything of store B', async () => {
    const dir = resolve(__dirname, '../../../apps/storefront/src/lib')
    const SKIP_LOADERS = new Set([
      'estimateForPincode', // courier serviceability API
      'cartShippingHint', // courier serviceability API
      'checkoutShipping', // courier serviceability API
    ])
    const files = readdirSync(dir).filter(
      (f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('-actions.ts'),
    )
    let called = 0
    let answered = 0
    for (const file of files) {
      let mod: Record<string, unknown>
      try {
        mod = await import(/* @vite-ignore */ join(dir, file))
      } catch {
        continue // needs Next.js at import time (cookies, headers): not a plain data loader
      }
      for (const [name, fn] of Object.entries(mod)) {
        if (typeof fn !== 'function' || SKIP_LOADERS.has(name)) continue
        const params = /^[^(]*\(([^)]*)\)/
          .exec(fn.toString())?.[1]
          ?.split(',')
          .map((p) => p.trim().split(/[\s=:]/)[0] ?? '')
        if (params?.[0] !== 'tx') continue
        for (const [strategy, target] of [
          ['probe', b],
          ['own', a],
        ] as const) {
          const args = params.slice(1).map((p) => {
            if (p === 'storeId') return a.storeId
            if (p === 'handle')
              return /[Cc]ollection/.test(name) ? target.collectionHandle : target.productHandle
            if (p === 'handles') return [target.productHandle]
            if (p === 'url' || p === 'urls')
              return p === 'url' ? target.mediaUrl : [target.mediaUrl]
            if (/Id$/.test(p)) return target.ids.get(snake(p.slice(0, -2)))?.[0]
            if (p === 'limit') return 10
            return undefined
          })
          called += 1
          try {
            const result = await withStore(app, a.storeId, (tx: StoreTx) =>
              (fn as (...x: unknown[]) => Promise<unknown>)(tx, ...args),
            )
            answered += 1
            const hits = leaksIn(await textOf(result), new Set())
            if (hits.length > 0)
              findings.push(`storefront ${file}#${name} [${strategy}]: ${hits[0]}`)
          } catch {
            // a loader refusing odd arguments is fine
          }
        }
      }
    }
    console.log(`[leak] storefront: ${called} loader calls, ${answered} answered`)
    expect(findings).toEqual([])
    expect(answered).toBeGreaterThan(10)
    // Sanity: there was a catalogue of A's own for the loaders to read.
    expect(a.productHandle).not.toBe('')
  }, 300_000)

  it('no oRPC procedure shows store A anything of store B, or lets A change B', async () => {
    const tables = new Set((await storeTables()).map((t) => t.name))
    const context = (): ApiContext => ({
      db: app,
      auth,
      headers: a.headers,
      notifications: { add: async () => undefined },
      appEvents: { add: async () => undefined },
      appJobs: { add: async () => undefined },
      mediaProcess: { add: async () => undefined },
      rateLimit: createMemoryRateLimitStore(),
    })
    const all = procedures(appRouter)
    const ran = new Set<string>()
    let calls = 0
    const errors = new Map<string, string[]>()

    // Probe with B's ids first (A's data still whole), then A's own ids (may change A).
    for (const [strategy, target] of [
      ['probe', b],
      ['own', a],
    ] as const) {
      for (const { path, proc } of all) {
        const name = path.join('.')
        if (SKIP[name]) continue
        const input = sampleInput(inputSchemaOf(proc), picker(target, path, tables))
        const given = uuidsIn(input)
        calls += 1
        try {
          const result = await call(proc as never, input as never, { context: context() })
          ran.add(name)
          const hits = leaksIn(await textOf(result), given)
          if (hits.length > 0)
            findings.push(
              `${name} [${strategy}] returned store B data: ${hits.slice(0, 3).join(', ')}`,
            )
        } catch (err) {
          const code = (err as { code?: string }).code ?? 'THROW'
          errors.set(code, [
            ...(errors.get(code) ?? []),
            `${name}[${strategy}]: ${err instanceof Error ? err.message.slice(0, 120) : ''}`,
          ])
          // A refusal is the expected answer to most probes. Its message must not leak either.
          const hits = leaksIn(err instanceof Error ? err.message : String(err), given)
          if (hits.length > 0)
            findings.push(`${name} [${strategy}] error mentions store B data: ${hits[0]}`)
        }
      }
    }

    // 2. Nothing of B changed.
    const bAfter = await dumpStore(b.storeId)
    for (const table of Object.keys(bBefore)) {
      if (bAfter[table] !== bBefore[table]) findings.push(`store B's ${table} rows changed`)
    }

    // 3. A holds no reference to B's rows.
    const aAfter = await dumpStore(a.storeId)
    const bIds = new Set([b.storeId, ...[...b.ids.values()].flat()])
    for (const [table, text] of Object.entries(aAfter)) {
      for (const id of bIds) {
        if (text.includes(id)) findings.push(`store A's ${table} now points at store B's ${id}`)
      }
    }

    const covered = ran.size
    const callable = all.length - Object.keys(SKIP).length
    console.log(
      `[leak] ${calls} calls over ${all.length} procedures (${Object.keys(SKIP).length} skipped); ` +
        `${covered} answered at least once without an error`,
    )
    if (process.env.LEAK_DEBUG) {
      for (const [code, list] of errors) {
        console.log(code, list.length, list.slice(0, 40).join(' | '))
      }
    }
    expect(findings).toEqual([])
    // Coverage floor (a ratchet: raise it as the input generator learns more shapes).
    expect(covered / callable).toBeGreaterThan(0.6)
  }, 600_000)
})
