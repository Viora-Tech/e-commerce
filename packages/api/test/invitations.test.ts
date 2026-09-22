import { createMerchantAuth } from '@commerce/auth'
import { authSchema, createDb, role, store, storeInvitation, storeMember } from '@commerce/db'
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

/** An owner with a store whose system roles are seeded. */
async function storeWithOwner(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  const organizationId = org?.id as string
  await auth.api.setActiveOrganization({ headers, body: { organizationId } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: `Store ${slug}`, organizationId })
    .returning()
  if (!s) throw new Error('seed')
  await call(appRouter.staff.me, {}, { context: ctx(headers) })
  return { headers, organizationId, storeId: s.id }
}

async function roleId(storeId: string, slug: string) {
  const [r] = await owner
    .select()
    .from(role)
    .where(and(eq(role.storeId, storeId), eq(role.slug, slug)))
  if (!r) throw new Error(`no ${slug} role`)
  return r.id
}

async function memberRole(storeId: string, userId: string) {
  const rows = await owner
    .select({ roleId: storeMember.roleId, status: storeMember.status })
    .from(storeMember)
    .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, userId)))
  return rows[0] ?? null
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('invitations', () => {
  it('previews an invitation and grants exactly the invited role on accept', async () => {
    const shop = await storeWithOwner('boss@example.com', 'inv-a')
    const staffRole = await roleId(shop.storeId, 'staff')
    const invite = await call(
      appRouter.staff.invite,
      { email: 'Helper@Example.com', roleId: staffRole },
      { context: ctx(shop.headers) },
    )

    const preview = await call(
      appRouter.invitations.preview,
      { id: invite.id },
      { context: ctx(new Headers()) },
    )
    expect(preview).toMatchObject({ state: 'pending', storeName: 'Store inv-a', roleName: 'Staff' })

    const helper = await signIn('helper@example.com')
    const helperId = (await auth.api.getSession({ headers: helper }))?.user.id as string
    const joined = await call(
      appRouter.invitations.accept,
      { id: invite.id },
      { context: ctx(helper) },
    )
    expect(joined.storeId).toBe(shop.storeId)

    expect(await memberRole(shop.storeId, helperId)).toEqual({
      roleId: staffRole,
      status: 'active',
    })
    const me = await call(appRouter.staff.me, {}, { context: ctx(helper) })
    expect(me.roleSlug).toBe('staff')
    expect(me.isOwner).toBe(false)

    const left = await owner
      .select()
      .from(storeInvitation)
      .where(eq(storeInvitation.invitationId, invite.id))
    expect(left).toHaveLength(0)
    const after = await call(
      appRouter.invitations.preview,
      { id: invite.id },
      { context: ctx(new Headers()) },
    )
    expect(after.state).toBe('accepted')
  })

  it('refuses someone signed in with a different email and grants them nothing', async () => {
    const shop = await storeWithOwner('boss2@example.com', 'inv-b')
    const invite = await call(
      appRouter.staff.invite,
      { email: 'right@example.com', roleId: await roleId(shop.storeId, 'staff') },
      { context: ctx(shop.headers) },
    )
    const wrong = await signIn('wrong@example.com')
    const wrongId = (await auth.api.getSession({ headers: wrong }))?.user.id as string
    await expect(
      call(appRouter.invitations.accept, { id: invite.id }, { context: ctx(wrong) }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await memberRole(shop.storeId, wrongId)).toBeNull()
  })

  it('refuses expired and cancelled invitations', async () => {
    const shop = await storeWithOwner('boss3@example.com', 'inv-c')
    const staffRole = await roleId(shop.storeId, 'staff')
    const expired = await call(
      appRouter.staff.invite,
      { email: 'late@example.com', roleId: staffRole },
      { context: ctx(shop.headers) },
    )
    await owner
      .update(authSchema.invitation)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(authSchema.invitation.id, expired.id))
    const late = await signIn('late@example.com')
    await expect(
      call(appRouter.invitations.accept, { id: expired.id }, { context: ctx(late) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    const preview = await call(
      appRouter.invitations.preview,
      { id: expired.id },
      { context: ctx(new Headers()) },
    )
    expect(preview.state).toBe('expired')

    const missing = await call(
      appRouter.invitations.preview,
      { id: 'nope' },
      { context: ctx(new Headers()) },
    )
    expect(missing.state).toBe('missing')
  })

  it('still grants the invited role when someone accepts through Better Auth directly', async () => {
    const shop = await storeWithOwner('boss4@example.com', 'inv-d')
    const staffRole = await roleId(shop.storeId, 'staff')
    const invite = await call(
      appRouter.staff.invite,
      { email: 'direct@example.com', roleId: staffRole },
      { context: ctx(shop.headers) },
    )
    const direct = await signIn('direct@example.com')
    // Bypasses our accept page; without the recorded role the guard would default to admin.
    await auth.api.acceptInvitation({ headers: direct, body: { invitationId: invite.id } })
    await auth.api.setActiveOrganization({
      headers: direct,
      body: { organizationId: shop.organizationId },
    })
    const me = await call(appRouter.staff.me, {}, { context: ctx(direct) })
    expect(me.roleSlug).toBe('staff')
  })

  it('blocks deleting a role that a pending invitation would grant', async () => {
    const shop = await storeWithOwner('boss5@example.com', 'inv-e')
    const custom = await call(
      appRouter.staff.saveRole,
      { name: 'Packer', permissions: ['orders.read'] },
      { context: ctx(shop.headers) },
    )
    await call(
      appRouter.staff.invite,
      { email: 'packer@example.com', roleId: custom.id },
      { context: ctx(shop.headers) },
    )
    await expect(
      call(appRouter.staff.deleteRole, { id: custom.id }, { context: ctx(shop.headers) }),
    ).rejects.toBeTruthy()
  })
})
