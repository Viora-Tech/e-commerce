/** SOURCE OF TRUTH: platform console tests — WHAT: the cross-store reads (overview, stores, users, audit), the read-only transaction, the staff allowlist and passkey check / WHY: the console sees every store, so its numbers must leave test orders out and its queries must never write */
import {
  appInstallation,
  authSchema,
  createDb,
  order,
  outboxEvent,
  planPayment,
  platformAccessLog,
  platformAuditEvent,
  role,
  store,
  storeDomain,
  storeMember,
  storePlan,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  isPlatformStaffEmail,
  platformRead,
  recordPlatformAccess,
  sessionUsedPasskey,
} from './access'
import { listPlatformAudit } from './audit'
import { platformOverview } from './overview'
import { likePattern, listPlatformStores, platformStoreDetail } from './stores'
import { listPlatformUsers } from './users'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
})

const NOW = new Date('2026-10-26T06:30:00Z') // 12:00 IST
const HOUR = 3_600_000
const DAY = 24 * HOUR
/** The Postgres error under Drizzle's "Failed query" wrapper. */
async function pgError(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    const err = e as { message?: string; cause?: { message?: string } }
    return err.cause?.message ?? err.message ?? ''
  }
  return 'no error'
}

const actor = { userId: 'u-staff', email: 'Staff@Koomerce.app' }

async function seedUser(id: string, email: string, name = id) {
  await owner.insert(authSchema.user).values({ id, email, name, emailVerified: true })
}

async function seedStore(slug: string, opts: { org?: string; createdAt?: Date } = {}) {
  if (opts.org) {
    await owner
      .insert(authSchema.organization)
      .values({ id: opts.org, name: slug, slug })
      .onConflictDoNothing()
  }
  const [s] = await owner
    .insert(store)
    .values({
      slug,
      name: `${slug} store`,
      organizationId: opts.org ?? null,
      createdAt: opts.createdAt ?? new Date(NOW.getTime() - 60 * DAY),
      apps: { installed: ['gst-invoices', 'shiprocket'] },
      payments: {
        enabled: ['cod', 'razorpay'],
        providers: {
          razorpay: { keyId: 'rzp_live_x', keySecret: 'enc:secret' },
          'cashfree~test': { appId: 'x' },
        },
      },
      notifications: { enabled: [], providers: { whatsapp: { token: 'enc:tok' } } },
    })
    .returning()
  if (!s) throw new Error('seed')
  return s.id
}

let orderNo = 1
async function seedOrder(
  storeId: string,
  totalPaise: number,
  placedAt: Date,
  extra: { isTest?: boolean; status?: 'open' | 'completed' | 'cancelled' | 'draft' } = {},
) {
  await owner.insert(order).values({
    storeId,
    number: orderNo++,
    email: 'shopper@example.com',
    subtotalPaise: totalPaise,
    totalPaise,
    placedAt,
    isTest: extra.isTest ?? false,
    status: extra.status ?? 'open',
  } as typeof order.$inferInsert)
}

describe('access', () => {
  it('lets in only emails on the list, case-insensitively, and nobody when it is empty', () => {
    expect(isPlatformStaffEmail('Staff@Koomerce.app', ['staff@koomerce.app'])).toBe(true)
    expect(isPlatformStaffEmail(' staff@koomerce.app ', ['staff@koomerce.app'])).toBe(true)
    expect(isPlatformStaffEmail('owner@shop.in', ['staff@koomerce.app'])).toBe(false)
    expect(isPlatformStaffEmail('staff@koomerce.app', [])).toBe(false)
    expect(isPlatformStaffEmail(null, ['staff@koomerce.app'])).toBe(false)
  })

  it('counts a session as second-factor only when it was opened with a passkey', async () => {
    await seedUser('u1', 'a@x.in')
    await owner.insert(authSchema.memberSignIn).values([
      { id: 's1', userId: 'u1', sessionId: 'sess-otp', method: 'email_otp' },
      { id: 's2', userId: 'u1', sessionId: 'sess-pk', method: 'passkey' },
    ])
    expect(await sessionUsedPasskey(owner, 'u1', 'sess-pk')).toBe(true)
    expect(await sessionUsedPasskey(owner, 'u1', 'sess-otp')).toBe(false)
    expect(await sessionUsedPasskey(owner, 'u1', 'unknown')).toBe(false)
    expect(await sessionUsedPasskey(owner, 'u2', 'sess-pk')).toBe(false)
  })

  it('platformRead refuses to write', async () => {
    const message = await pgError(
      platformRead(owner, (tx) =>
        tx.execute(sql`insert into store (id, slug, name) values (gen_random_uuid(), 'x', 'x')`),
      ),
    )
    expect(message).toMatch(/read-only/)
  })

  it('writes the access log with a lowercased actor and a capped target', async () => {
    const storeId = await seedStore('asha')
    await recordPlatformAccess(owner, {
      actor,
      action: 'stores.detail',
      storeId,
      target: 'x'.repeat(500),
    })
    const [row] = await owner.select().from(platformAccessLog)
    expect(row).toMatchObject({
      actorEmail: 'staff@koomerce.app',
      action: 'stores.detail',
      storeId,
    })
    expect(row?.target).toHaveLength(300)
  })

  it('the app role cannot read the access log', async () => {
    const app = createDb(process.env.DATABASE_URL as string)
    try {
      expect(await pgError(app.select().from(platformAccessLog))).toMatch(/permission denied/)
    } finally {
      await app.$client.end()
    }
  })
})

describe('overview', () => {
  it('counts stores by plan state, sales without test or cancelled orders, MRR and outbox', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b', { createdAt: new Date(NOW.getTime() - 2 * DAY) })
    const c = await seedStore('c')
    await seedStore('d')
    await owner.insert(storePlan).values([
      { storeId: a, plan: 'growth', interval: 'month', status: 'active' },
      { storeId: b, plan: 'pro', interval: 'year', status: 'trialing' },
      { storeId: c, plan: 'starter', interval: 'month', status: 'paused' },
    ])
    await seedOrder(a, 1000_00, new Date(NOW.getTime() - HOUR))
    await seedOrder(a, 500_00, new Date(NOW.getTime() - 3 * DAY), { status: 'completed' })
    await seedOrder(b, 200_00, new Date(NOW.getTime() - 20 * DAY))
    await seedOrder(b, 9999_00, new Date(NOW.getTime() - HOUR), { isTest: true })
    await seedOrder(b, 7777_00, new Date(NOW.getTime() - HOUR), { status: 'cancelled' })
    await seedOrder(b, 300_00, new Date(NOW.getTime() - 40 * DAY))
    await owner.insert(planPayment).values({
      storeId: c,
      plan: 'starter',
      interval: 'month',
      salesOrderId: '019a0000-0000-7000-8000-000000000001',
      salesOrderNumber: 7,
      amountPaise: 58_882,
      periodStart: new Date(NOW.getTime() - 5 * DAY),
      periodEnd: new Date(NOW.getTime() + 25 * DAY),
      status: 'due',
    })
    await owner.insert(outboxEvent).values([
      { storeId: a, type: 'order.placed', payload: {}, createdAt: new Date(NOW.getTime() - HOUR) },
      { storeId: a, type: 'order.placed', payload: {}, attempts: 2, lastError: 'boom' },
      { storeId: a, type: 'order.placed', payload: {}, dispatchedAt: NOW },
    ])

    const o = await platformOverview(owner, NOW)
    expect(o.stores).toEqual({
      total: 4,
      active: 1,
      trialing: 1,
      paused: 1,
      cancelled: 0,
      noPlan: 1,
      newThisWeek: 1,
    })
    expect(o.sales.today).toEqual({ orders: 1, gmvPaise: 1000_00 })
    expect(o.sales.days7).toEqual({ orders: 2, gmvPaise: 1500_00 })
    expect(o.sales.days30).toEqual({ orders: 3, gmvPaise: 1700_00 })
    expect(o.subscriptions.mrrPaise).toBe(1_49_900)
    expect(o.subscriptions.plans.find((p) => p.plan === 'growth')).toEqual({
      plan: 'growth',
      stores: 1,
      mrrPaise: 1_49_900,
    })
    expect(o.payments).toEqual({ billsDue: 1, billsOverdue: 1, autopayHalted: 0 })
    expect(o.outbox.pending).toBe(2)
    expect(o.outbox.failing).toBe(1)
    expect(o.outbox.oldestPendingAt).toBeInstanceOf(Date)
  })
})

describe('stores', () => {
  it('escapes LIKE wildcards in a search', () => {
    expect(likePattern('50%_off\\')).toBe('%50\\%\\_off\\\\%')
  })

  it('lists stores with owner, domain, 30-day sales and apps; searches by owner email and domain', async () => {
    await seedUser('owner-a', 'asha@shop.in')
    await seedUser('owner-b', 'bina@shop.in')
    const a = await seedStore('asha', { org: 'org-a' })
    const b = await seedStore('bina', { org: 'org-b' })
    await owner.insert(authSchema.member).values([
      { id: 'm1', organizationId: 'org-a', userId: 'owner-a', role: 'owner' },
      { id: 'm2', organizationId: 'org-b', userId: 'owner-b', role: 'owner' },
    ])
    await owner
      .insert(storeDomain)
      .values({ storeId: a, hostname: 'asha.in', isPrimary: true, kind: 'custom' })
    await owner.insert(authSchema.memberSignIn).values({
      id: 'si',
      userId: 'owner-a',
      sessionId: 's',
      method: 'passkey',
      createdAt: new Date(NOW.getTime() - HOUR),
    })
    await seedOrder(a, 400_00, new Date(NOW.getTime() - DAY))
    await seedOrder(a, 100_00, new Date(NOW.getTime() - DAY), { isTest: true })
    await owner.insert(storePlan).values({ storeId: b, plan: 'pro', status: 'paused' })

    const all = await listPlatformStores(owner, {}, NOW)
    expect(all.total).toBe(2)
    const rowA = all.rows.find((r) => r.id === a)
    expect(rowA).toMatchObject({
      domain: 'asha.in',
      ownerEmail: 'asha@shop.in',
      orders30d: 1,
      gmv30dPaise: 400_00,
      appsInstalled: 2,
      plan: null,
    })
    expect(rowA?.lastActiveAt?.getTime()).toBe(NOW.getTime() - HOUR)

    expect(
      (await listPlatformStores(owner, { search: 'BINA@shop' }, NOW)).rows.map((r) => r.id),
    ).toEqual([b])
    expect(
      (await listPlatformStores(owner, { search: 'asha.in' }, NOW)).rows.map((r) => r.id),
    ).toEqual([a])
    expect(
      (await listPlatformStores(owner, { state: 'paused' }, NOW)).rows.map((r) => r.id),
    ).toEqual([b])
    expect((await listPlatformStores(owner, { state: 'none' }, NOW)).rows.map((r) => r.id)).toEqual(
      [a],
    )
    expect((await listPlatformStores(owner, { page: 2 }, NOW)).rows).toEqual([])
  })

  it('store detail names connected providers but never returns their settings', async () => {
    await seedUser('staff-1', 'ravi@shop.in', 'Ravi')
    const a = await seedStore('asha')
    const [r] = await owner
      .insert(role)
      .values({ storeId: a, name: 'Owner', slug: 'owner', isSystem: true })
      .returning()
    await owner
      .insert(storeMember)
      .values({ storeId: a, userId: 'staff-1', roleId: r?.id as string })
    await owner.insert(appInstallation).values({
      storeId: a,
      pluginId: 'shiprocket',
      lastError: 'Shiprocket refused the token',
      lastErrorAt: NOW,
    })
    await owner
      .insert(outboxEvent)
      .values({ storeId: a, type: 'order.paid', payload: {}, lastError: 'queue down' })

    const d = await platformStoreDetail(owner, a, NOW)
    expect(d?.store.slug).toBe('asha')
    expect(d?.staff).toMatchObject([{ name: 'Ravi', email: 'ravi@shop.in', role: 'Owner' }])
    expect(d?.apps.map((x) => x.id)).toEqual(['gst-invoices', 'shiprocket'])
    expect(d?.apps[1]?.lastError).toBe('Shiprocket refused the token')
    expect(d?.integrations.payments).toEqual([
      { id: 'cashfree', enabled: false, configured: true },
      { id: 'cod', enabled: true, configured: false },
      { id: 'razorpay', enabled: true, configured: true },
    ])
    expect(d?.integrations.notifications).toEqual([
      { id: 'whatsapp', enabled: false, configured: true },
    ])
    expect(d?.errors).toMatchObject([{ source: 'outbox', what: 'order.paid', error: 'queue down' }])
    const text = JSON.stringify(d)
    expect(text).not.toContain('rzp_live_x')
    expect(text).not.toContain('enc:')

    expect(await platformStoreDetail(owner, '019a0000-0000-7000-8000-00000000dead', NOW)).toBeNull()
  })
})

describe('users', () => {
  it('lists users with their stores, roles, last sign-in and passkey', async () => {
    await seedUser('u1', 'asha@shop.in', 'Asha')
    await seedUser('u2', 'bina@shop.in', 'Bina')
    const a = await seedStore('asha')
    const [r] = await owner
      .insert(role)
      .values({ storeId: a, name: 'Staff', slug: 'staff' })
      .returning()
    await owner.insert(storeMember).values({ storeId: a, userId: 'u1', roleId: r?.id as string })
    await owner.insert(authSchema.passkey).values({
      id: 'pk',
      userId: 'u1',
      publicKey: 'k',
      credentialID: 'c',
      counter: 0,
      deviceType: 'singleDevice',
      backedUp: false,
    })
    await owner
      .insert(authSchema.memberSignIn)
      .values({ id: 'si', userId: 'u1', sessionId: 's', method: 'passkey' })

    const list = await listPlatformUsers(owner, {})
    expect(list.total).toBe(2)
    const asha = list.rows.find((u) => u.id === 'u1')
    expect(asha).toMatchObject({
      passkey: true,
      lastSignInMethod: 'passkey',
      stores: [{ storeId: a, name: 'asha store', role: 'Staff', status: 'active' }],
    })
    expect(list.rows.find((u) => u.id === 'u2')).toMatchObject({ passkey: false, stores: [] })
    expect((await listPlatformUsers(owner, { search: 'bina' })).rows.map((u) => u.id)).toEqual([
      'u2',
    ])
  })
})

describe('audit', () => {
  it('filters the console log by store, actor and date, and reads store events', async () => {
    const a = await seedStore('asha')
    await recordPlatformAccess(owner, { actor, action: 'stores.detail', storeId: a })
    await recordPlatformAccess(owner, {
      actor: { userId: 'u9', email: 'ops@koomerce.app' },
      action: 'overview.read',
    })
    await owner.insert(platformAuditEvent).values({
      subjectStoreId: a,
      subjectStoreName: 'asha store',
      actorEmail: 'asha@shop.in',
      action: 'store.export_requested',
      detail: { tables: 3 },
    })

    const all = await listPlatformAudit(owner, {})
    expect(all.total).toBe(2)
    const byStore = await listPlatformAudit(owner, { storeId: a })
    expect(byStore.rows).toMatchObject([{ action: 'stores.detail', storeName: 'asha store' }])
    expect((await listPlatformAudit(owner, { actor: 'OPS@' })).rows.map((r) => r.action)).toEqual([
      'overview.read',
    ])
    expect((await listPlatformAudit(owner, { from: new Date(Date.now() + DAY) })).total).toBe(0)

    const events = await listPlatformAudit(owner, { source: 'store' })
    expect(events.rows).toMatchObject([
      { action: 'store.export_requested', storeId: a, actorEmail: 'asha@shop.in' },
    ])
    expect(events.rows[0]?.detail).toContain('"tables"')
  })
})
