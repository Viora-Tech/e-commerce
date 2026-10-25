import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  address,
  createDb,
  customer,
  discount,
  order,
  orderLine,
  product,
  type StoreTx,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { applyAsAffiliate } from '../src/affiliates'
import { commissionForOrder, creditOrder } from '../src/commissions'
import {
  archiveProgram,
  createProgram,
  defaultProgram,
  listPrograms,
  programBySlug,
  saveProgram,
  setAffiliateProgram,
  setAffiliateRate,
} from '../src/programs'
import { affiliate, affiliateProgram } from '../src/schema'
import {
  type AffiliateSettings,
  defaultAffiliateSettings,
  defaultProgramRules,
  type ProgramRules,
} from '../src/settings'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-secret-test-secret-test-secret-00'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const settings: AffiliateSettings = { ...defaultAffiliateSettings, approval: 'auto' }

async function seed(entry?: Record<string, unknown>) {
  const slug = `s-${Math.random().toString(36).slice(2)}`
  const [s] = await owner
    .insert(store)
    .values({
      slug,
      name: slug,
      apps: entry ? { installed: ['affiliates'], settings: { affiliates: entry } } : null,
    })
    .returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mat', title: 'Mat' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Default', pricePaise: 1180_00 })
    .returning()
  if (!v) throw new Error('seed')
  const [c] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: 'asha@example.com', name: 'Asha' })
    .returning()
  if (!c) throw new Error('seed')
  return { storeId: s.id, variantId: v.id, customerId: c.id }
}

let numbers = 5000
async function placeOrder(
  storeId: string,
  variantId: string,
  over: Partial<typeof order.$inferInsert> = {},
) {
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Buyer',
      line1: '5 Park Street',
      city: 'Kolkata',
      stateCode: 'WB',
      pincode: '700016',
      phone: '9000000001',
    })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: numbers++,
      email: `buyer${numbers}@example.com`,
      phone: '+91 90000 00001',
      shippingAddressId: a?.id,
      status: 'open',
      paymentStatus: 'paid',
      subtotalPaise: 1180_00,
      totalPaise: 1180_00,
      ...over,
    })
    .returning()
  if (!o) throw new Error('seed')
  await owner.insert(orderLine).values({
    storeId,
    orderId: o.id,
    variantId,
    quantity: 1,
    unitPricePaise: 1180_00,
    gstRatePercent: 18,
  })
  return o
}

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

const ref = (code: string) => ({ channel: 'affiliate', ref: code, at: new Date().toISOString() })

const newAffiliate = (
  storeId: string,
  customerId: string | null,
  over: { programId?: string; email?: string } = {},
) =>
  inStore(storeId, (tx) =>
    applyAsAffiliate(
      tx,
      storeId,
      {
        customerId,
        email: over.email ?? 'asha@example.com',
        phone: '+91 98765 43210',
        name: 'Asha K',
        social: '@asha',
        message: '',
        programId: over.programId,
      },
      settings,
      SECRET,
    ),
  )

const rulesWith = (over: Partial<ProgramRules>): ProgramRules => ({
  ...defaultProgramRules,
  ...over,
})

/** The backfill statements of the programs migration, whatever number it ended up with. */
function backfillStatements(): string[] {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/drizzle')
  const file = readdirSync(dir).find((f) => f.endsWith('_affiliate_programs.sql'))
  if (!file) throw new Error('programs migration not found')
  return readFileSync(path.join(dir, file), 'utf8')
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => /INSERT INTO "affiliate_program"|^UPDATE "affiliate/m.test(s))
}

describe('default program', () => {
  it('the migration copies a v1 entry into one default program and points affiliates at it', async () => {
    const entry = { commission: { type: 'percent', bp: 1500 }, holdDays: 3, approval: 'auto' }
    const s = await seed(entry)
    const [a] = await owner
      .insert(affiliate)
      .values({ storeId: s.storeId, code: 'old-one', name: 'Old', status: 'approved' })
      .returning()
    const statements = backfillStatements()
    expect(statements).toHaveLength(3)
    for (const run of [1, 2]) {
      for (const st of statements) await owner.execute(sql.raw(st))
      const programs = await owner
        .select()
        .from(affiliateProgram)
        .where(eq(affiliateProgram.storeId, s.storeId))
      expect(programs, `run ${run}`).toHaveLength(1)
      expect(programs[0]).toMatchObject({ name: 'Default', slug: 'default', isDefault: true })
      expect(programs[0]?.rules).toEqual(entry)
    }
    const [row] = await owner
      .select()
      .from(affiliate)
      .where(eq(affiliate.id, a?.id as string))
    const [p] = await owner
      .select()
      .from(affiliateProgram)
      .where(eq(affiliateProgram.storeId, s.storeId))
    expect(row?.programId).toBe(p?.id)
  })

  it('made on first use from a v1 entry, so an order earns exactly what it did before', async () => {
    const s = await seed({ commission: { type: 'percent', bp: 1500 } })
    const a = await newAffiliate(s.storeId, s.customerId)
    const o = await placeOrder(s.storeId, s.variantId, { attribution: ref(a.code) })
    const c = await inStore(s.storeId, (tx) => creditOrder(tx, s.storeId, o.id, settings, SECRET))
    const p = await inStore(s.storeId, (tx) => defaultProgram(tx, s.storeId))
    expect(c).toMatchObject({ basePaise: 1000_00, commissionPaise: 150_00, programId: p.id })
    expect(a.programId).toBe(p.id)
  })
})

describe('programs', () => {
  it('earns under the affiliate’s program: levels, own rate, and a move keeps old commissions', async () => {
    const s = await seed()
    const creators = await inStore(s.storeId, (tx) =>
      createProgram(tx, s.storeId, {
        name: 'Creators',
        rules: rulesWith({
          commission: { type: 'percent', bp: 2000 },
          levels: [{ minOrderPaise: 1000_00, rule: { type: 'percent', bp: 2500 } }],
          coupon: { enabled: true, bp: 1500 },
        }),
      }),
    )
    expect(creators.slug).toBe('creators')
    const a = await newAffiliate(s.storeId, s.customerId)
    const first = await placeOrder(s.storeId, s.variantId, { attribution: ref(a.code) })
    await inStore(s.storeId, (tx) => creditOrder(tx, s.storeId, first.id, settings, SECRET))

    await inStore(s.storeId, (tx) => setAffiliateProgram(tx, s.storeId, a.id, creators.id))
    const [d] = await owner
      .select()
      .from(discount)
      .where(eq(discount.id, a.discountId as string))
    expect(d?.value).toBe(1500)

    // Lifetime is off, so each order needs its own link; the ₹1,180 order passes the level.
    const second = await placeOrder(s.storeId, s.variantId, { attribution: ref(a.code) })
    const c2 = await inStore(s.storeId, (tx) =>
      creditOrder(tx, s.storeId, second.id, settings, SECRET),
    )
    expect(c2).toMatchObject({ commissionPaise: 250_00, programId: creators.id })
    // The first commission keeps the default program's 10%.
    const c1 = await inStore(s.storeId, (tx) => commissionForOrder(tx, first.id))
    expect(c1?.commissionPaise).toBe(100_00)

    await inStore(s.storeId, (tx) => setAffiliateRate(tx, a.id, { type: 'percent', bp: 3000 }))
    const third = await placeOrder(s.storeId, s.variantId, { attribution: ref(a.code) })
    const c3 = await inStore(s.storeId, (tx) =>
      creditOrder(tx, s.storeId, third.id, settings, SECRET),
    )
    expect(c3?.commissionPaise).toBe(300_00)
  })

  it('binds a returning customer by the first affiliate’s program scope', async () => {
    const s = await seed()
    const p = await inStore(s.storeId, (tx) => defaultProgram(tx, s.storeId))
    await inStore(s.storeId, (tx) =>
      saveProgram(tx, s.storeId, p.id, {
        name: p.name,
        slug: p.slug,
        rules: rulesWith({ scope: 'lifetime', lifetimeDays: 30 }),
      }),
    )
    const a = await newAffiliate(s.storeId, s.customerId)
    const [buyer] = await owner
      .insert(customer)
      .values({ storeId: s.storeId, email: 'buyer@example.com', name: 'B' })
      .returning()
    const first = await placeOrder(s.storeId, s.variantId, {
      attribution: ref(a.code),
      customerId: buyer?.id,
    })
    await inStore(s.storeId, (tx) => creditOrder(tx, s.storeId, first.id, settings, SECRET))
    const again = await placeOrder(s.storeId, s.variantId, { customerId: buyer?.id })
    const c = await inStore(s.storeId, (tx) =>
      creditOrder(tx, s.storeId, again.id, settings, SECRET),
    )
    expect(c).toMatchObject({ source: 'lifetime', affiliateId: a.id })
  })

  it('archives a program by moving its affiliates; the default stays open; slugs are unique', async () => {
    const s = await seed()
    const fallback = await inStore(s.storeId, (tx) => defaultProgram(tx, s.storeId))
    const vip = await inStore(s.storeId, (tx) =>
      createProgram(tx, s.storeId, { name: 'VIP', rules: defaultProgramRules }),
    )
    const vip2 = await inStore(s.storeId, (tx) =>
      createProgram(tx, s.storeId, { name: 'VIP', rules: defaultProgramRules }),
    )
    expect(vip2.slug).toBe('vip-2')
    await expect(
      inStore(s.storeId, (tx) =>
        saveProgram(tx, s.storeId, vip2.id, { name: 'VIP', slug: 'vip', rules: vip2.rules }),
      ),
    ).rejects.toThrow('Another program uses that link')
    const a = await newAffiliate(s.storeId, s.customerId, { programId: vip.id })
    expect(a.programId).toBe(vip.id)
    const r = await inStore(s.storeId, (tx) => archiveProgram(tx, s.storeId, vip.id, fallback.id))
    expect(r.moved).toBe(1)
    const [row] = await owner.select().from(affiliate).where(eq(affiliate.id, a.id))
    expect(row?.programId).toBe(fallback.id)
    expect(await inStore(s.storeId, (tx) => programBySlug(tx, s.storeId, 'vip'))).toBeNull()
    await expect(
      inStore(s.storeId, (tx) => archiveProgram(tx, s.storeId, fallback.id, vip2.id)),
    ).rejects.toThrow('The default program stays open')
    const list = await inStore(s.storeId, (tx) => listPrograms(tx, s.storeId))
    expect(list[0]).toMatchObject({ id: fallback.id, affiliates: 1 })
    await expect(
      newAffiliate(s.storeId, null, { programId: vip.id, email: 'x@example.com' }),
    ).rejects.toThrow('Program not found')
  })
})
