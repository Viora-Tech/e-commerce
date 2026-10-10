import { createMerchantAuth } from '@commerce/auth'
import { createDb, customer, order, role, store, storeMember } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

/* CMS PR4: extra fields on customers, orders, the shop... guarded by the record's own access. */

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

async function signIn(email: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  return new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
}

function ctx(headers: Headers): ApiContext {
  return { db: app, auth, headers, notifications: { add: async () => undefined } }
}

/** An owner with a store, plus a member on the system Staff role. */
async function team() {
  const boss = await signIn('boss@example.com')
  const org = await auth.api.createOrganization({ headers: boss, body: { name: 'mf', slug: 'mf' } })
  const organizationId = org?.id as string
  await auth.api.setActiveOrganization({ headers: boss, body: { organizationId } })
  const [s] = await owner
    .insert(store)
    .values({ slug: 'mf', name: 'MF', organizationId })
    .returning()
  const storeId = s?.id as string
  await call(appRouter.staff.me, {}, { context: ctx(boss) })

  const helper = await signIn('helper@example.com')
  const helperId = (await auth.api.getSession({ headers: helper }))?.user.id as string
  await auth.api.addMember({ body: { userId: helperId, role: 'member', organizationId } })
  await auth.api.setActiveOrganization({ headers: helper, body: { organizationId } })
  const [staffRole] = await owner
    .select()
    .from(role)
    .where(and(eq(role.storeId, storeId), eq(role.slug, 'staff')))
  await owner
    .insert(storeMember)
    .values({ storeId, userId: helperId, roleId: staffRole?.id as string })
  return { storeId, boss: ctx(boss), staff: ctx(helper) }
}

const note = (ownerType: 'customer' | 'order' | 'shop' | 'page') => ({
  ownerType,
  name: 'Note',
  type: 'single_line_text' as const,
})

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('extra fields on customers, orders and the shop', () => {
  it('lets each member fill in only the records their role can edit', async () => {
    const t = await team()
    const [cu] = await owner
      .insert(customer)
      .values({ storeId: t.storeId, email: 'asha@example.com' })
      .returning()
    const [o] = await owner
      .insert(order)
      .values({
        storeId: t.storeId,
        number: 1,
        status: 'open',
        subtotalPaise: 100,
        totalPaise: 100,
      })
      .returning()
    const orderDef = await call(appRouter.metaobjects.createMetafieldDefinition, note('order'), {
      context: t.boss,
    })
    const customerDef = await call(
      appRouter.metaobjects.createMetafieldDefinition,
      note('customer'),
      { context: t.boss },
    )

    // Staff work orders: they may fill in an order's extra fields...
    await call(
      appRouter.metaobjects.setMetafields,
      { ownerType: 'order', ownerId: o?.id as string, values: { [orderDef.id]: 'Gift wrap' } },
      { context: t.staff },
    )
    const read = await call(
      appRouter.metaobjects.metafields,
      { ownerType: 'order', ownerId: o?.id as string },
      { context: t.staff },
    )
    expect(read.values).toEqual({ [orderDef.id]: 'Gift wrap' })
    // ...read a customer's, but not change them (customers: read only)...
    await call(
      appRouter.metaobjects.metafields,
      { ownerType: 'customer', ownerId: cu?.id as string },
      { context: t.staff },
    )
    await expect(
      call(
        appRouter.metaobjects.setMetafields,
        { ownerType: 'customer', ownerId: cu?.id as string, values: { [customerDef.id]: 'x' } },
        { context: t.staff },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    // ...and never touch pages, the shop, or the fields themselves.
    await expect(
      call(appRouter.metaobjects.metafieldDefinitions, { ownerType: 'page' }, { context: t.staff }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      call(appRouter.metaobjects.metafields, { ownerType: 'shop' }, { context: t.staff }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      call(appRouter.metaobjects.createMetafieldDefinition, note('order'), { context: t.staff }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      call(
        appRouter.metaobjects.createDefinition,
        { name: 'FAQ', fields: [{ key: 'q', name: 'Q', type: 'single_line_text' }] },
        { context: t.staff },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('stores the shop’s own values against the store, whatever id is sent', async () => {
    const t = await team()
    const def = await call(appRouter.metaobjects.createMetafieldDefinition, note('shop'), {
      context: t.boss,
    })
    await call(
      appRouter.metaobjects.setMetafields,
      {
        ownerType: 'shop',
        ownerId: '00000000-0000-4000-8000-000000000001',
        values: { [def.id]: '+91 98765 43210' },
      },
      { context: t.boss },
    )
    const got = await call(
      appRouter.metaobjects.metafields,
      { ownerType: 'shop' },
      { context: t.boss },
    )
    expect(got.values).toEqual({ [def.id]: '+91 98765 43210' })
    const [row] = await owner.select().from(store).where(eq(store.id, t.storeId))
    expect(row?.id).toBe(t.storeId)
  })

  it('asks which record when the owner is not the shop', async () => {
    const t = await team()
    await expect(
      call(appRouter.metaobjects.metafields, { ownerType: 'order' }, { context: t.boss }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})
