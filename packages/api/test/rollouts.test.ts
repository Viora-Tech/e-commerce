import { createMerchantAuth } from '@commerce/auth'
import { defaultTheme } from '@commerce/core'
import { createDb, discount, role, store, storeMember, theme } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call, ORPCError } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { classifyAction } from '../src/mcp/action-catalogue'
import { appRouter } from '../src/routers/_app'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const sent: { otp: string }[] = []
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

const contextOf = (headers: Headers) =>
  ({ db: app, auth, headers, notifications: { add: async () => undefined } }) as ApiContext

/** A signed-in owner with a store holding a live theme, a sale theme and two discounts. */
async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  const storeId = s?.id as string
  const [live, sale] = await owner
    .insert(theme)
    .values([
      { storeId, name: 'Everyday', role: 'main', settings: defaultTheme },
      { storeId, name: 'Diwali', role: 'unpublished', settings: defaultTheme },
    ])
    .returning()
  const [offer] = await owner
    .insert(discount)
    .values({
      storeId,
      title: 'DIWALI10',
      kind: 'code',
      code: 'DIWALI10',
      method: 'percent',
      value: 10,
      status: 'disabled',
    })
    .returning()
  return {
    context: contextOf(headers),
    organizationId: org?.id as string,
    storeId,
    live: live?.id as string,
    sale: sale?.id as string,
    offer: offer?.id as string,
  }
}

/** A second member of the store on one of its system roles. */
async function member(m: Awaited<ReturnType<typeof merchant>>, email: string, slug: string) {
  // The store's roles are seeded on its first call.
  await call(appRouter.staff.me, {}, { context: m.context })
  const headers = await signIn(email)
  const session = await auth.api.getSession({ headers })
  const userId = session?.user.id as string
  await auth.api.addMember({ body: { userId, role: 'member', organizationId: m.organizationId } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: m.organizationId } })
  const [r] = await owner
    .select()
    .from(role)
    .where(and(eq(role.storeId, m.storeId), eq(role.slug, slug)))
  const roleId = r?.id as string
  const [existing] = await owner
    .select()
    .from(storeMember)
    .where(and(eq(storeMember.storeId, m.storeId), eq(storeMember.userId, userId)))
  if (existing) {
    await owner.update(storeMember).set({ roleId }).where(eq(storeMember.id, existing.id))
  } else {
    await owner.insert(storeMember).values({ storeId: m.storeId, userId, roleId })
  }
  return contextOf(headers)
}

/** The oRPC code a call was refused with. */
async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (err) {
    if (err instanceof ORPCError) return err.code
    throw err
  }
  return 'accepted'
}

const liveTheme = async (storeId: string) => {
  const [t] = await owner
    .select({ id: theme.id })
    .from(theme)
    .where(and(eq(theme.storeId, storeId), eq(theme.role, 'main')))
  return t?.id
}

const HOUR = 3_600_000

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('rollouts router', () => {
  it('saves an event, starts it now, pauses, resumes and rolls it back', async () => {
    const m = await merchant('a@example.com', 'store-a')
    const { context } = m
    const offerChange = {
      kind: 'discount' as const,
      discountId: m.offer,
      status: 'active' as const,
    }
    const event = {
      name: 'Diwali sale',
      kind: 'event' as const,
      startsAt: new Date(Date.now() + HOUR),
      endsAt: new Date(Date.now() + 72 * HOUR),
      changes: [{ kind: 'theme' as const, themeId: m.sale }, offerChange],
    }
    const saved = await call(appRouter.rollouts.create, event, { context })
    expect(saved).toMatchObject({ status: 'scheduled', kind: 'event' })
    expect(saved.changes.map((c) => ('label' in c ? c.label : null))).toEqual([
      'Diwali',
      'DIWALI10',
    ])
    expect(await call(appRouter.rollouts.holds, undefined, { context })).toMatchObject({
      themes: { [m.sale]: { name: 'Diwali sale' } },
      discounts: { [m.offer]: { name: 'Diwali sale' } },
    })

    // A second rollout with the same discount clashes.
    const clash = { ...event, name: 'Clash', changes: [offerChange] }
    const conflicts = await call(appRouter.rollouts.checkConflicts, clash, { context })
    expect(conflicts).toMatchObject([{ level: 'block', rolloutName: 'Diwali sale' }])
    expect(await refusal(call(appRouter.rollouts.create, clash, { context }))).toBe('CONFLICT')
    // Checking itself is no clash.
    expect(
      await call(appRouter.rollouts.checkConflicts, { ...event, id: saved.id }, { context }),
    ).toEqual([])

    const started = await call(appRouter.rollouts.startNow, { id: saved.id }, { context })
    expect(started.status).toBe('active')
    expect(await liveTheme(m.storeId)).toBe(m.sale)
    expect(await refusal(call(appRouter.rollouts.delete, { id: saved.id }, { context }))).toBe(
      'CONFLICT',
    )

    expect((await call(appRouter.rollouts.pause, { id: saved.id }, { context })).status).toBe(
      'paused',
    )
    expect(await liveTheme(m.storeId)).toBe(m.live)
    expect((await call(appRouter.rollouts.resume, { id: saved.id }, { context })).status).toBe(
      'active',
    )
    expect(await liveTheme(m.storeId)).toBe(m.sale)

    const ended = await call(
      appRouter.rollouts.end,
      { id: saved.id, action: 'rollback' },
      { context },
    )
    expect(ended).toMatchObject({ status: 'ended', endAction: 'rollback' })
    expect(await liveTheme(m.storeId)).toBe(m.live)
    const [d] = await owner.select().from(discount).where(eq(discount.id, m.offer))
    expect(d?.status).toBe('disabled')

    expect(
      (await call(appRouter.rollouts.list, { statuses: ['ended'] }, { context })).map((r) => r.id),
    ).toEqual([saved.id])
    expect(await call(appRouter.rollouts.list, { statuses: ['active'] }, { context })).toEqual([])
    await call(appRouter.rollouts.archive, { id: saved.id }, { context })
    expect(await call(appRouter.rollouts.delete, { id: saved.id }, { context })).toEqual({
      ok: true,
    })
    expect(await refusal(call(appRouter.rollouts.get, { id: saved.id }, { context }))).toBe(
      'NOT_FOUND',
    )
  })

  it('launches for good, and refuses a start when the theme was deleted', async () => {
    const m = await merchant('b@example.com', 'store-b')
    const { context } = m
    const launch = await call(
      appRouter.rollouts.create,
      { name: 'New look', changes: [{ kind: 'theme', themeId: m.sale }] },
      { context },
    )
    expect(launch.status).toBe('draft')
    expect((await call(appRouter.rollouts.startNow, { id: launch.id }, { context })).status).toBe(
      'ended',
    )
    expect(await liveTheme(m.storeId)).toBe(m.sale)

    const gone = await call(
      appRouter.rollouts.create,
      { name: 'Back', changes: [{ kind: 'theme', themeId: m.live }] },
      { context },
    )
    await owner.delete(theme).where(eq(theme.id, m.live))
    expect(
      await call(
        appRouter.rollouts.checkConflicts,
        { id: gone.id, name: 'Back', changes: [{ kind: 'theme', themeId: m.live }] },
        { context },
      ),
    ).toMatchObject([{ level: 'warn' }])
    expect(await refusal(call(appRouter.rollouts.startNow, { id: gone.id }, { context }))).toBe(
      'BAD_REQUEST',
    )
    expect(await liveTheme(m.storeId)).toBe(m.sale)
  })

  it('lists themes and discounts for the pickers, in this store only', async () => {
    const a = await merchant('c@example.com', 'store-c')
    await merchant('d@example.com', 'store-d')
    const themes = await call(appRouter.rollouts.listThemes, undefined, { context: a.context })
    expect(themes.map((t) => [t.id, t.live])).toEqual([
      [a.live, true],
      [a.sale, false],
    ])
    const discounts = await call(
      appRouter.rollouts.listDiscounts,
      { search: 'diwali' },
      { context: a.context },
    )
    expect(discounts).toMatchObject({ total: 1, items: [{ id: a.offer }] })
  })

  it('lets staff read nothing and admins manage; ending and deleting wait for approval over MCP', async () => {
    const m = await merchant('e@example.com', 'store-e')
    const staff = await member(m, 'staff@example.com', 'staff')
    const admin = await member(m, 'admin@example.com', 'admin')
    expect(await refusal(call(appRouter.rollouts.list, {}, { context: staff }))).toBe('FORBIDDEN')
    expect(
      await refusal(
        call(appRouter.rollouts.create, { name: 'x', changes: [] }, { context: staff }),
      ),
    ).toBe('FORBIDDEN')
    expect(
      (await call(appRouter.rollouts.create, { name: 'x', changes: [] }, { context: admin }))
        .status,
    ).toBe('draft')

    expect(classifyAction('rollouts.list')).toBe('read')
    expect(classifyAction('rollouts.holds')).toBe('read')
    expect(classifyAction('rollouts.checkConflicts')).toBe('read')
    expect(classifyAction('rollouts.create')).toBe('write')
    expect(classifyAction('rollouts.end')).toBe('sensitive')
    expect(classifyAction('rollouts.delete')).toBe('sensitive')
  })
})
