import { createMerchantAuth } from '@commerce/auth'
import { createDb, role, rolePermission, store, storeMember } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const sent: { email: string; otp: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})
async function merchant(email: string, slug: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  const ctx: ApiContext = { db: app, auth, headers, notifications: { add: async () => undefined } }
  return { ctx, storeId: s?.id as string, orgId: org?.id as string }
}
/** A second member of `m`'s store on a custom role that holds only `perms`. */
async function memberWith(m: { storeId: string; orgId: string }, email: string, perms: string[]) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const userId = (await auth.api.getSession({ headers }))?.user.id as string
  await auth.api.addMember({ body: { userId, role: 'member', organizationId: m.orgId } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: m.orgId } })
  const [r] = await owner
    .insert(role)
    .values({ storeId: m.storeId, name: 'Bookkeeper', slug: 'bookkeeper' })
    .returning()
  await owner
    .insert(rolePermission)
    .values(
      perms.map((permission) => ({ storeId: m.storeId, roleId: r?.id as string, permission })),
    )
  const [existing] = await owner
    .select()
    .from(storeMember)
    .where(and(eq(storeMember.storeId, m.storeId), eq(storeMember.userId, userId)))
  if (existing)
    await owner
      .update(storeMember)
      .set({ roleId: r?.id as string })
      .where(eq(storeMember.id, existing.id))
  else
    await owner.insert(storeMember).values({ storeId: m.storeId, userId, roleId: r?.id as string })
  return { db: app, auth, headers, notifications: { add: async () => undefined } } as ApiContext
}
beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/**
 * `store.shell` is the layout's seven per-page reads in one call. It must answer what the
 * separate calls did, and leave out (null) what the member's role cannot read.
 */
describe('store.shell', () => {
  it('matches the separate calls for the owner', async () => {
    const m = await merchant('owner@example.com', 'shell-a')
    const context = m.ctx
    const shell = await call(appRouter.store.shell, undefined, { context })
    const [apps, logo, toShip, usage, testMode, approvals] = await Promise.all([
      call(appRouter.apps.list, undefined, { context }),
      call(appRouter.themes.logo, undefined, { context }),
      call(appRouter.orders.toShipCount, undefined, { context }),
      call(appRouter.billing.usage, undefined, { context }),
      call(appRouter.payments.testMode, undefined, { context }),
      call(appRouter.approvals.counts, undefined, { context }),
    ])
    expect(shell).toEqual({
      apps,
      // No installed app declares an app bar read yet: nothing to show, nothing read.
      appBars: {},
      logo,
      // Orders waiting (the Orders count) and To book rows (the Shipments count): none yet.
      toShip: { orders: toShip, parcels: 0 },
      usage,
      testMode: testMode.testMode,
      approvals,
      // Inbox is not installed: `inbox.counts` refuses, the shell says null.
      inbox: null,
      // The Drafts badge (#1443): a new store has no unpaid checkout drafts.
      drafts: 0,
    })
    await expect(call(appRouter.inbox.counts, undefined, { context })).rejects.toThrow()
  })

  it('leaves out what a role cannot read', async () => {
    const m = await merchant('owner2@example.com', 'shell-b')
    const context = await memberWith(m, 'packer@example.com', ['orders.read'])
    const shell = await call(appRouter.store.shell, undefined, { context })
    expect(shell.apps).toBeNull()
    expect(shell.appBars).toBeNull()
    expect(shell.usage).toBeNull()
    expect(shell.logo).toBeNull()
    expect(shell.testMode).toBe(false)
    expect(shell.inbox).toBeNull()
    expect(shell.drafts).toBeNull()
    expect(shell.toShip?.orders).toBe(
      await call(appRouter.orders.toShipCount, undefined, { context }),
    )
    expect(shell.approvals).toEqual(await call(appRouter.approvals.counts, undefined, { context }))
    await expect(call(appRouter.apps.list, undefined, { context })).rejects.toThrow()
  })
})

/**
 * The app bar extras (Figma App layout v2): installed apps that declare `appBar` add their status
 * pill and sidebar page counts to the same `store.shell` call; nothing else is read.
 */
describe('store.shell app bars', () => {
  it('reads the GST invoices pill and queue count once installed', async () => {
    const m = await merchant('bars@example.com', 'shell-bars')
    const context = m.ctx
    await owner.update(store).set({ gstin: '06ABCDE1234F1Z5' }).where(eq(store.id, m.storeId))
    expect((await call(appRouter.store.shell, undefined, { context })).appBars).toEqual({})
    await call(appRouter.apps.install, { id: 'gst-invoices' }, { context })
    await call(appRouter.apps.install, { id: 'delhivery' }, { context })
    const { appBars } = await call(appRouter.store.shell, undefined, { context })
    expect(appBars?.['gst-invoices']?.statusPill?.label).toMatch(
      /^GSTIN 06ABCDE1234F1Z5 · numbering \d{4}-\d{2}$/,
    )
    // An empty queue counts nothing, so the sidebar shows no pill.
    expect(appBars?.['gst-invoices']?.pageCounts).toEqual({})
    expect(appBars?.delhivery?.statusPill).toEqual({
      label: 'No parcels booked yet',
      tone: 'neutral',
      at: null,
    })
  })
})
