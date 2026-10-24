import { createMerchantAuth } from '@commerce/auth'
import { settingsSecret } from '@commerce/config'
import { encryptSecret } from '@commerce/core'
import { createDb, pixelConnection, store } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { eq } from 'drizzle-orm'
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
const FAKE_TOKEN = 'EAAfake-router-token-000000000'

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
    ctx: {
      db: app,
      auth,
      headers,
      notifications: { add: async () => undefined },
    } as unknown as ApiContext,
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

describe('pixels router', () => {
  it('refuses until the Pixels app is installed', async () => {
    const m = await merchant('a@example.com', 'store-a')
    await expect(call(appRouter.pixels.list, undefined, { context: m.ctx })).rejects.toThrow(
      /Install the Pixels app/,
    )
  })

  it('lists, edits and pauses pixels without ever returning the token', async () => {
    const m = await merchant('b@example.com', 'store-b')
    await owner
      .update(store)
      .set({ apps: { installed: ['pixels'] } })
      .where(eq(store.id, m.storeId))
    const secret = settingsSecret()
    const [px] = await owner
      .insert(pixelConnection)
      .values({
        storeId: m.storeId,
        pixelId: '1234567890',
        tokenEnc: encryptSecret(FAKE_TOKEN, secret),
        tokenHint: '0000',
      })
      .returning()
    const id = px?.id as string
    const list = await call(appRouter.pixels.list, undefined, { context: m.ctx })
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ hasToken: true, tokenHint: '0000', status: 'active' })
    const updated = await call(
      appRouter.pixels.update,
      { id, purchaseTrigger: 'paid_or_delivered', events: ['PageView', 'Purchase'] },
      { context: m.ctx },
    )
    expect(updated.purchaseTrigger).toBe('paid_or_delivered')
    const paused = await call(
      appRouter.pixels.setStatus,
      { id, status: 'paused' },
      { context: m.ctx },
    )
    const got = await call(appRouter.pixels.get, { id }, { context: m.ctx })
    const stats = await call(appRouter.pixels.stats, undefined, { context: m.ctx })
    const log = await call(appRouter.pixels.log.list, {}, { context: m.ctx })
    expect(paused.status).toBe('paused')
    expect(stats).toEqual({ sent: 0, purchases: 0, failed: 0, skippedNoConsent: 0 })
    expect(log.total).toBe(0)
    const everything = JSON.stringify([list, updated, paused, got])
    expect(everything).not.toContain(FAKE_TOKEN)
    expect(everything).not.toContain('tokenEnc')
    await call(appRouter.pixels.remove, { id }, { context: m.ctx })
    expect(await call(appRouter.pixels.list, undefined, { context: m.ctx })).toEqual([])
  })

  it('keeps token changes out of MCP and treats remove as sensitive', () => {
    expect(classifyAction('pixels.setToken')).toBeNull()
    expect(classifyAction('pixels.clearToken')).toBeNull()
    expect(classifyAction('pixels.list')).toBe('read')
    expect(classifyAction('pixels.log.list')).toBe('read')
    expect(classifyAction('pixels.stats')).toBe('read')
    expect(classifyAction('pixels.create')).toBe('write')
    expect(classifyAction('pixels.setStatus')).toBe('write')
    expect(classifyAction('pixels.sendTest')).toBe('write')
    expect(classifyAction('pixels.remove')).toBe('sensitive')
  })
})
