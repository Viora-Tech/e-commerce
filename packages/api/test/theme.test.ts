import { createMerchantAuth } from '@commerce/auth'
import { loadEnv } from '@commerce/config'
import {
  applyThemePreset,
  defaultTheme,
  THEME_PRESET_IDS,
  verifyThemePreviewToken,
} from '@commerce/core'
import { createDb, role, store, storeMember } from '@commerce/db'
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

const ctx = (headers: Headers): ApiContext => ({
  db: app,
  auth,
  headers,
  notifications: { add: async () => undefined },
})

async function merchantWithStore(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  if (!s) throw new Error('seed')
  return { headers, organizationId: org?.id as string, storeId: s.id }
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('store theme', () => {
  it('reads the default for a store that never saved one, and round-trips a preset', async () => {
    const m = await merchantWithStore('theme@example.com', 'theme-a')
    const first = await call(appRouter.store.getTheme, undefined, { context: ctx(m.headers) })
    expect(first.theme).toEqual(defaultTheme)
    expect(
      verifyThemePreviewToken({
        secret: loadEnv(process.env).SETTINGS_SECRET,
        storeId: m.storeId,
        token: first.previewToken,
      }),
    ).toBe(true)

    const soft = applyThemePreset(defaultTheme, 'soft')
    const saved = await call(appRouter.store.updateTheme, soft, { context: ctx(m.headers) })
    expect(saved.preset).toBe('soft')
    const second = await call(appRouter.store.getTheme, undefined, { context: ctx(m.headers) })
    expect(second.theme).toEqual(soft)
    expect(THEME_PRESET_IDS).toContain(saved.preset)
  })

  it('rejects a scheme id that could escape the storefront style block', async () => {
    const m = await merchantWithStore('xss@example.com', 'theme-b')
    const evil = {
      ...defaultTheme,
      schemes: defaultTheme.schemes.map((s, i) =>
        i === 0 ? { ...s, id: 'x{}</style><script>alert(1)</script>' } : s,
      ),
    }
    await expect(
      call(appRouter.store.updateTheme, evil, { context: ctx(m.headers) }),
    ).rejects.toThrow()
  })

  it('needs online store write, which the staff role does not have', async () => {
    const boss = await merchantWithStore('boss-theme@example.com', 'theme-c')
    await call(appRouter.staff.me, {}, { context: ctx(boss.headers) })

    const helperHeaders = await signIn('helper-theme@example.com')
    const helperId = (await auth.api.getSession({ headers: helperHeaders }))?.user.id as string
    await auth.api.addMember({
      body: { userId: helperId, role: 'member', organizationId: boss.organizationId },
    })
    await auth.api.setActiveOrganization({
      headers: helperHeaders,
      body: { organizationId: boss.organizationId },
    })
    const [staff] = await owner
      .select()
      .from(role)
      .where(and(eq(role.storeId, boss.storeId), eq(role.slug, 'staff')))
    if (!staff) throw new Error('no staff role')
    await owner
      .insert(storeMember)
      .values({ storeId: boss.storeId, userId: helperId, roleId: staff.id })

    await expect(
      call(appRouter.store.updateTheme, defaultTheme, { context: ctx(helperHeaders) }),
    ).rejects.toThrow()
  })
})
