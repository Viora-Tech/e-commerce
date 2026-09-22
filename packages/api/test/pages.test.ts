import { createMerchantAuth } from '@commerce/auth'
import { createDb, page, store } from '@commerce/db'
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

describe('pages', () => {
  it('creates a hidden page, then edits its content, SEO, template and visibility', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const created = await call(
      appRouter.pages.create,
      { handle: 'about', title: 'About' },
      { context: a.ctx },
    )
    expect(created?.publishedAt).toBeNull()

    const body = { root: { type: 'root', children: [] } }
    const updated = await call(
      appRouter.pages.update,
      {
        id: created?.id as string,
        body,
        seoTitle: 'About us',
        templateSuffix: 'about',
        visible: true,
      },
      { context: a.ctx },
    )
    expect(updated).toMatchObject({ body, seoTitle: 'About us', templateSuffix: 'about' })
    expect(updated?.publishedAt).not.toBeNull()

    const cleared = await call(
      appRouter.pages.update,
      { id: created?.id as string, templateSuffix: '', visible: false },
      { context: a.ctx },
    )
    const [row] = await owner
      .select()
      .from(page)
      .where(eq(page.id, created?.id as string))
    expect(cleared?.templateSuffix).toBeNull()
    expect(row?.publishedAt).toBeNull()
  })

  it('handles are unique per store, not globally', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const b = await merchant('b@example.com', 'store-b')
    await call(appRouter.pages.create, { handle: 'home', title: 'A' }, { context: a.ctx })
    await call(appRouter.pages.create, { handle: 'home', title: 'B' }, { context: b.ctx })
    const listA = await call(appRouter.pages.list, undefined, { context: a.ctx })
    expect(listA.map((p) => p.title)).toEqual(['A'])
    await expect(
      call(appRouter.pages.create, { handle: 'home', title: 'A again' }, { context: a.ctx }),
    ).rejects.toThrow()
  })
})
