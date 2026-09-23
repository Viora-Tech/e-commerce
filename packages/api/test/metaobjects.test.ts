import { createMerchantAuth } from '@commerce/auth'
import { createDb, store } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
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

describe('metaobjects', () => {
  it('creates a definition and entries, and answers 400 with field errors', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const ctx = { context: a.ctx }
    const def = await call(
      appRouter.metaobjects.createDefinition,
      {
        name: 'Size guide',
        fields: [{ key: 'title', name: 'Title', type: 'single_line_text', required: true }],
      },
      ctx,
    )
    expect(def.type).toBe('size_guide')
    const entry = await call(
      appRouter.metaobjects.createEntry,
      { definitionId: def.id, fields: { title: 'Mice' } },
      ctx,
    )
    expect(entry.handle).toBe('mice')
    const err = await call(
      appRouter.metaobjects.createEntry,
      { definitionId: def.id, fields: {} },
      ctx,
    ).catch((e: unknown) => e)
    expect(err).toMatchObject({
      code: 'BAD_REQUEST',
      data: { fieldErrors: { title: 'Title is required' } },
    })
    const list = await call(appRouter.metaobjects.entries, { definitionId: def.id }, ctx)
    expect(list.rows.map((r) => r.displayName)).toEqual(['Mice'])
    const byType = await call(appRouter.metaobjects.definition, { type: 'size_guide' }, ctx)
    expect(byType.entries).toBe(1)
  })

  it('keeps each store to its own definitions', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const b = await merchant('b@example.com', 'store-b')
    await call(
      appRouter.metaobjects.createDefinition,
      { name: 'Author', fields: [] },
      { context: a.ctx },
    )
    expect(await call(appRouter.metaobjects.definitions, undefined, { context: b.ctx })).toEqual([])
  })
})
