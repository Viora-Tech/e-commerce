import { createMerchantAuth } from '@commerce/auth'
import { createDb, role, store, storeMember } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

/**
 * Faster product pages (beta), `preferences.delivery.honoProduct`: only the store owner changes
 * it, through the shared preferences save, and only the owner gets the preview link's token.
 */

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

const ctx = (headers: Headers) =>
  ({ db: app, auth, headers, notifications: { add: async () => undefined } }) as ApiContext

async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  return { ctx: ctx(headers), storeId: s?.id as string, orgId: org?.id as string }
}

/** A member with the Administrator role: Online store write, but not the owner. */
async function administrator(boss: { storeId: string; orgId: string; ctx: ApiContext }) {
  await call(appRouter.staff.me, {}, { context: boss.ctx })
  const headers = await signIn('admin@example.com')
  const userId = (await auth.api.getSession({ headers }))?.user.id as string
  await auth.api.addMember({ body: { userId, role: 'member', organizationId: boss.orgId } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: boss.orgId } })
  const [admin] = await owner
    .select()
    .from(role)
    .where(and(eq(role.storeId, boss.storeId), eq(role.slug, 'admin')))
  const [existing] = await owner
    .select()
    .from(storeMember)
    .where(and(eq(storeMember.storeId, boss.storeId), eq(storeMember.userId, userId)))
  if (existing) {
    await owner
      .update(storeMember)
      .set({ roleId: admin?.id as string })
      .where(eq(storeMember.id, existing.id))
  } else {
    await owner
      .insert(storeMember)
      .values({ storeId: boss.storeId, userId, roleId: admin?.id as string })
  }
  return ctx(headers)
}

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

describe('faster product pages switch', () => {
  it('only the owner changes it; an administrator saves everything else around it', async () => {
    const boss = await merchant('owner@example.com', 'waimers')
    const prefs = await call(appRouter.store.getPreferences, undefined, { context: boss.ctx })
    expect(prefs.delivery.honoProduct).toBe(false)

    const on = await call(
      appRouter.store.updatePreferences,
      { ...prefs, delivery: { ...prefs.delivery, honoProduct: true } },
      { context: boss.ctx },
    )
    expect(on.delivery.honoProduct).toBe(true)

    const admin = await administrator(boss)
    const seen = await call(appRouter.store.getPreferences, undefined, { context: admin })
    const saved = await call(
      appRouter.store.updatePreferences,
      {
        ...seen,
        seo: { ...seen.seo, title: 'Waimers gaming gear' },
        delivery: { ...seen.delivery, honoProduct: false },
      },
      { context: admin },
    )
    expect(saved.seo.title).toBe('Waimers gaming gear')
    expect(saved.delivery.honoProduct).toBe(true)

    const off = await call(
      appRouter.store.updatePreferences,
      { ...saved, delivery: { ...saved.delivery, honoProduct: false } },
      { context: boss.ctx },
    )
    expect(off.delivery.honoProduct).toBe(false)
  })

  it('signs the preview link for the owner only', async () => {
    const boss = await merchant('owner@example.com', 'waimers')
    const { token } = await call(appRouter.honoPreview.token, undefined, {
      context: boss.ctx,
    })
    expect(token).toMatch(/^\d+\.[A-Za-z0-9_-]+$/)
    const admin = await administrator(boss)
    await expect(
      call(appRouter.honoPreview.token, undefined, { context: admin }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
