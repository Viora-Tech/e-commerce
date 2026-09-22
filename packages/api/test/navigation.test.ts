import { createMerchantAuth } from '@commerce/auth'
import { toNavLinks } from '@commerce/core'
import { createDb, store } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
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
  return {
    ctx: { db: app, auth, headers, notifications: { add: async () => undefined } } as ApiContext,
    storeId: s?.id as string,
  }
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const items = [
  { id: 'i1', title: 'Glasspads', type: 'collection' as const, value: 'glasspads' },
  { id: 'i2', title: 'Discord', type: 'url' as const, value: 'https://discord.gg/waimers' },
]

describe('navigation', () => {
  it('starts with no storefront pointer and saves one', async () => {
    const a = await merchant('a@example.com', 'store-a')
    expect(await call(appRouter.navigation.settings, undefined, { context: a.ctx })).toEqual({
      main: null,
      footer: [],
    })

    const menu = await call(
      appRouter.navigation.save,
      { title: 'Main menu', handle: 'main-menu', items },
      { context: a.ctx },
    )
    const saved = await call(
      appRouter.navigation.updateSettings,
      { main: 'main-menu', footer: [] },
      { context: a.ctx },
    )
    expect(saved).toEqual({ main: 'main-menu', footer: [] })
    expect(await call(appRouter.navigation.settings, undefined, { context: a.ctx })).toEqual({
      main: 'main-menu',
      footer: [],
    })

    // What the storefront turns the saved items into.
    const read = await call(
      appRouter.navigation.get,
      { id: menu?.id as string },
      { context: a.ctx },
    )
    expect(toNavLinks(read?.items ?? [])).toEqual([
      { label: 'Glasspads', href: '/collections/glasspads' },
      { label: 'Discord', href: 'https://discord.gg/waimers' },
    ])
  })

  it('drops a menu from the pointer when the menu is deleted', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const header = await call(
      appRouter.navigation.save,
      { title: 'Main menu', handle: 'main-menu', items },
      { context: a.ctx },
    )
    const column = await call(
      appRouter.navigation.save,
      { title: 'Shop', handle: 'footer-shop', items },
      { context: a.ctx },
    )
    await call(
      appRouter.navigation.updateSettings,
      { main: 'main-menu', footer: ['footer-shop'] },
      { context: a.ctx },
    )

    expect(
      await call(appRouter.navigation.delete, { id: header?.id as string }, { context: a.ctx }),
    ).toBe(true)
    expect(await call(appRouter.navigation.settings, undefined, { context: a.ctx })).toEqual({
      main: null,
      footer: ['footer-shop'],
    })

    await call(appRouter.navigation.delete, { id: column?.id as string }, { context: a.ctx })
    expect(await call(appRouter.navigation.settings, undefined, { context: a.ctx })).toEqual({
      main: null,
      footer: [],
    })
  })

  it('keeps menus and the pointer inside their own store', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const b = await merchant('b@example.com', 'store-b')
    await call(
      appRouter.navigation.save,
      { title: 'A menu', handle: 'main-menu', items },
      { context: a.ctx },
    )
    await call(
      appRouter.navigation.updateSettings,
      { main: 'main-menu', footer: [] },
      { context: a.ctx },
    )

    expect(await call(appRouter.navigation.list, undefined, { context: b.ctx })).toEqual([])
    expect(await call(appRouter.navigation.settings, undefined, { context: b.ctx })).toEqual({
      main: null,
      footer: [],
    })
    const [row] = await owner.select().from(store).where(eq(store.slug, 'store-a'))
    expect(row?.navigation).toEqual({ main: 'main-menu', footer: [] })
  })

  it('rejects a footer of more columns than the storefront can render', async () => {
    const a = await merchant('a@example.com', 'store-a')
    await expect(
      call(
        appRouter.navigation.updateSettings,
        { main: null, footer: Array.from({ length: 9 }, (_, i) => `menu-${i}`) },
        { context: a.ctx },
      ),
    ).rejects.toThrow()
  })
})
