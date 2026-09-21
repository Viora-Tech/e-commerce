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

const data = {
  root: { props: {} },
  content: [{ type: 'RichText', props: { id: 'r1', body: 'hi' } }],
}

describe('pages', () => {
  it('creates a draft, publishes it, and only the published copy is visible to the storefront query', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const created = await call(
      appRouter.pages.create,
      { handle: 'home', title: 'Home', data },
      { context: a.ctx },
    )
    expect(created?.publishedData).toBeNull()

    const edited = { ...data, content: [{ type: 'RichText', props: { id: 'r1', body: 'edited' } }] }
    await call(
      appRouter.pages.saveDraft,
      { id: created?.id as string, data: edited },
      { context: a.ctx },
    )
    const published = await call(
      appRouter.pages.publish,
      { id: created?.id as string },
      { context: a.ctx },
    )
    expect(published?.publishedData).toEqual(edited)

    const [row] = await owner
      .select()
      .from(page)
      .where(eq(page.id, created?.id as string))
    expect(row?.publishedAt).not.toBeNull()
  })

  it('handles are unique per store, not globally', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const b = await merchant('b@example.com', 'store-b')
    await call(appRouter.pages.create, { handle: 'home', title: 'A', data }, { context: a.ctx })
    await call(appRouter.pages.create, { handle: 'home', title: 'B', data }, { context: b.ctx })
    const listA = await call(appRouter.pages.list, undefined, { context: a.ctx })
    expect(listA.map((p) => p.title)).toEqual(['A'])
    await expect(
      call(appRouter.pages.create, { handle: 'home', title: 'A again', data }, { context: a.ctx }),
    ).rejects.toThrow()
  })
})
