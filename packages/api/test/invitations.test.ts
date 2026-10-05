import { createMerchantAuth, type SendInvite } from '@commerce/auth'
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
const invites: Parameters<SendInvite>[0][] = []
/** Flip to make the next invite emails fail, like a refused SES send. */
let inviteEmailFails = false
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
  sendInvite: async (i) => {
    if (inviteEmailFails) throw new Error("Couldn't send the invite email")
    invites.push(i)
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
  invites.length = 0
  inviteEmailFails = false
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

describe('pending invitations', () => {
  it('emails the invite with the store name and role, and lists it until accepted', async () => {
    const shop = await storeWithOwner('lister@example.com', 'pend-a')
    const staffRole = await roleId(shop.storeId, 'staff')
    const invite = await call(
      appRouter.staff.invite,
      { email: 'new@example.com', roleId: staffRole },
      { context: ctx(shop.headers) },
    )
    expect(invite.emailSent).toBe(true)
    expect(invites).toHaveLength(1)
    expect(invites[0]).toMatchObject({
      email: 'new@example.com',
      storeName: 'Store pend-a',
      roleLabel: 'Staff',
      inviterEmail: 'lister@example.com',
      acceptUrl: `http://localhost:3200/accept-invitation/${invite.id}`,
    })

    const list = await call(appRouter.staff.invitations, {}, { context: ctx(shop.headers) })
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      id: invite.id,
      email: 'new@example.com',
      roleId: staffRole,
      roleName: 'Staff',
      invitedBy: 'lister@example.com',
      expired: false,
    })
    expect(new Date(list[0]?.expiresAt as Date).getTime()).toBeGreaterThan(Date.now())

    const joiner = await signIn('new@example.com')
    await call(appRouter.invitations.accept, { id: invite.id }, { context: ctx(joiner) })
    expect(await call(appRouter.staff.invitations, {}, { context: ctx(shop.headers) })).toEqual([])
  })

  it('reports an invite whose email failed, and keeps it listed to resend', async () => {
    const shop = await storeWithOwner('fail@example.com', 'pend-b')
    inviteEmailFails = true
    const invite = await call(
      appRouter.staff.invite,
      { email: 'nomail@example.com', roleId: await roleId(shop.storeId, 'staff') },
      { context: ctx(shop.headers) },
    )
    expect(invite.emailSent).toBe(false)
    const list = await call(appRouter.staff.invitations, {}, { context: ctx(shop.headers) })
    expect(list.map((i) => i.id)).toEqual([invite.id])
    expect(list[0]?.roleName).toBe('Staff')

    inviteEmailFails = false
    const again = await call(
      appRouter.staff.resendInvitation,
      { id: invite.id },
      { context: ctx(shop.headers) },
    )
    expect(again).toMatchObject({ id: invite.id, emailSent: true })
    expect(invites.at(-1)).toMatchObject({ email: 'nomail@example.com', roleLabel: 'Staff' })
  })

  it('resends an open invite with a fresh expiry and replaces an expired one', async () => {
    const shop = await storeWithOwner('resend@example.com', 'pend-c')
    const adminRole = await roleId(shop.storeId, 'admin')
    const invite = await call(
      appRouter.staff.invite,
      { email: 'again@example.com', roleId: adminRole },
      { context: ctx(shop.headers) },
    )
    const soon = new Date(Date.now() + 60_000)
    await owner
      .update(authSchema.invitation)
      .set({ expiresAt: soon })
      .where(eq(authSchema.invitation.id, invite.id))

    const resent = await call(
      appRouter.staff.resendInvitation,
      { id: invite.id },
      { context: ctx(shop.headers) },
    )
    expect(resent.id).toBe(invite.id)
    expect(invites).toHaveLength(2)
    const [row] = await owner
      .select()
      .from(authSchema.invitation)
      .where(eq(authSchema.invitation.id, invite.id))
    expect(row?.expiresAt.getTime()).toBeGreaterThan(soon.getTime())

    // Expired: Better Auth makes a new invitation; the role moves over and the old one closes.
    await owner
      .update(authSchema.invitation)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(authSchema.invitation.id, invite.id))
    const listed = await call(appRouter.staff.invitations, {}, { context: ctx(shop.headers) })
    expect(listed[0]).toMatchObject({ id: invite.id, expired: true })

    const renewed = await call(
      appRouter.staff.resendInvitation,
      { id: invite.id },
      { context: ctx(shop.headers) },
    )
    expect(renewed.id).not.toBe(invite.id)
    expect(invites.at(-1)).toMatchObject({ roleLabel: 'Administrator' })
    const after = await call(appRouter.staff.invitations, {}, { context: ctx(shop.headers) })
    expect(after).toHaveLength(1)
    expect(after[0]).toMatchObject({ id: renewed.id, roleId: adminRole, expired: false })
    const old = await call(
      appRouter.invitations.preview,
      { id: invite.id },
      { context: ctx(new Headers()) },
    )
    expect(old.state).toBe('cancelled')
  })

  it('cancels an invite so its link stops working', async () => {
    const shop = await storeWithOwner('cancel@example.com', 'pend-d')
    const invite = await call(
      appRouter.staff.invite,
      { email: 'gone@example.com', roleId: await roleId(shop.storeId, 'staff') },
      { context: ctx(shop.headers) },
    )
    await call(appRouter.staff.cancelInvitation, { id: invite.id }, { context: ctx(shop.headers) })
    expect(await call(appRouter.staff.invitations, {}, { context: ctx(shop.headers) })).toEqual([])
    const left = await owner
      .select()
      .from(storeInvitation)
      .where(eq(storeInvitation.invitationId, invite.id))
    expect(left).toHaveLength(0)
    const gone = await signIn('gone@example.com')
    await expect(
      call(appRouter.invitations.accept, { id: invite.id }, { context: ctx(gone) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(
      call(appRouter.staff.cancelInvitation, { id: invite.id }, { context: ctx(shop.headers) }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it("never shows or touches another store's invitations, even for someone who runs both", async () => {
    const a = await storeWithOwner('both@example.com', 'pend-e')
    const invite = await call(
      appRouter.staff.invite,
      { email: 'a-only@example.com', roleId: await roleId(a.storeId, 'staff') },
      { context: ctx(a.headers) },
    )
    // Same person, second store, now the active one: Better Auth alone would let them act on A.
    const b = await storeWithOwner('both@example.com', 'pend-f')
    expect(await call(appRouter.staff.invitations, {}, { context: ctx(b.headers) })).toEqual([])
    await expect(
      call(appRouter.staff.cancelInvitation, { id: invite.id }, { context: ctx(b.headers) }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      call(appRouter.staff.resendInvitation, { id: invite.id }, { context: ctx(b.headers) }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    // A different owner entirely.
    const c = await storeWithOwner('other@example.com', 'pend-g')
    await expect(
      call(appRouter.staff.cancelInvitation, { id: invite.id }, { context: ctx(c.headers) }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await call(appRouter.staff.invitations, {}, { context: ctx(c.headers) })).toEqual([])

    const still = await call(appRouter.staff.invitations, {}, { context: ctx(a.headers) })
    expect(still.map((i) => i.id)).toEqual([invite.id])
  })

  it('needs staff.invite to cancel or resend', async () => {
    const shop = await storeWithOwner('perm@example.com', 'pend-h')
    const staffRole = await roleId(shop.storeId, 'staff')
    const helperInvite = await call(
      appRouter.staff.invite,
      { email: 'helper@example.com', roleId: staffRole },
      { context: ctx(shop.headers) },
    )
    const helper = await signIn('helper@example.com')
    await call(appRouter.invitations.accept, { id: helperInvite.id }, { context: ctx(helper) })
    await auth.api.setActiveOrganization({
      headers: helper,
      body: { organizationId: shop.organizationId },
    })
    const other = await call(
      appRouter.staff.invite,
      { email: 'later@example.com', roleId: staffRole },
      { context: ctx(shop.headers) },
    )
    await expect(
      call(appRouter.staff.cancelInvitation, { id: other.id }, { context: ctx(helper) }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      call(appRouter.staff.resendInvitation, { id: other.id }, { context: ctx(helper) }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
