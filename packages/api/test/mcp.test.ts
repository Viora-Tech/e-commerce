import { createHash, randomBytes } from 'node:crypto'
import { createMerchantAuth } from '@commerce/auth'
import { authenticateApiToken, createMemoryRateLimitStore } from '@commerce/core'
import {
  aiAction,
  apiActivity,
  createDb,
  customer,
  discount,
  product,
  store,
  variant,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { decideAuthorize, handleRegister, handleToken } from '../src/mcp/oauth'
import { handleMcpRequest } from '../src/mcp/server'
import { appRouter } from '../src/routers/_app'

/*
 * Settings → MCP & API end to end against the test database: an AI client registers, signs in
 * with PKCE, lists and calls tools, makes changes with the member's role; access tokens
 * act as their member capped to their areas; nothing crosses to another store.
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
const ORIGIN = 'http://localhost:3200'
const rateLimit = createMemoryRateLimitStore()
const host = { db: app, origin: ORIGIN, rateLimit }

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function signIn(email: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  return new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
}

function ctx(headers: Headers, extra: Partial<ApiContext> = {}): ApiContext {
  return {
    db: app,
    auth,
    headers,
    notifications: { add: async () => undefined },
    rateLimit,
    ...extra,
  }
}

async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: `Store ${slug}`, organizationId: org?.id as string })
    .returning()
  const session = await auth.api.getSession({ headers })
  // Seeds the roles and the owner's membership.
  await call(appRouter.staff.me, {}, { context: ctx(headers) })
  return { ctx: ctx(headers), storeId: s?.id as string, userId: session?.user.id as string, slug }
}

async function seedProduct(storeId: string, title: string) {
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: title.toLowerCase().replace(/\s+/g, '-'), title, status: 'active' })
    .returning()
  await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: 'Default', pricePaise: 199_900 })
}

/** Registers a client and signs it in the way Claude does: PKCE, code, token. */
async function connect(m: { userId: string; slug: string }, name = 'Claude') {
  const reg = await handleRegister(
    new Request(`${ORIGIN}/api/oauth/register`, {
      method: 'POST',
      body: JSON.stringify({
        client_name: name,
        redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      }),
    }),
    host,
  )
  expect(reg.status).toBe(201)
  const client = (await reg.json()) as { client_id: string }
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const params = {
    response_type: 'code',
    client_id: client.client_id,
    redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'xyz',
    resource: `${ORIGIN}/api/mcp/${m.slug}`,
  }
  const back = new URL(
    await decideAuthorize(app, ORIGIN, {
      params,
      userId: m.userId,
      slug: m.slug,
      scopes: { products: 'read', discounts: 'write', customers: 'read' },
      allow: true,
    }),
  )
  expect(back.searchParams.get('state')).toBe('xyz')
  const token = await handleToken(
    new Request(`${ORIGIN}/api/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: back.searchParams.get('code') as string,
        redirect_uri: params.redirect_uri,
        client_id: client.client_id,
        code_verifier: verifier,
      }),
    }),
    host,
  )
  expect(token.status).toBe(200)
  const body = (await token.json()) as { access_token: string; refresh_token: string }
  return { ...body, clientId: client.client_id }
}

async function rpc(slug: string, token: string | null, method: string, params?: unknown) {
  const res = await handleMcpRequest(
    new Request(`${ORIGIN}/api/mcp/${slug}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
    slug,
    host,
  )
  return {
    res,
    // biome-ignore lint/suspicious/noExplicitAny: a JSON-RPC answer read field by field in assertions
    body: res.status === 200 ? ((await res.json()) as { result?: any; error?: unknown }) : null,
  }
}

describe('MCP over OAuth', () => {
  it('asks a client without a token to sign in, pointing at the metadata', async () => {
    const m = await merchant('asha@example.com', 'asha')
    const { res } = await rpc(m.slug, null, 'initialize')
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toContain(
      `resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/api/mcp/asha"`,
    )
  })

  it('signs in with PKCE, lists only granted tools, reads, and changes with the role', async () => {
    const m = await merchant('asha@example.com', 'asha')
    await seedProduct(m.storeId, 'Glide Mouse')
    const t = await connect(m)

    const init = await rpc(m.slug, t.access_token, 'initialize', { protocolVersion: '2025-06-18' })
    expect(init.body?.result.protocolVersion).toBe('2025-06-18')

    const list = await rpc(m.slug, t.access_token, 'tools/list')
    const names = ((list.body?.result?.tools ?? []) as { name: string }[]).map((x) => x.name)
    expect(names).toContain('findProducts')
    expect(names).toContain('proposeDiscount')
    expect(names).toContain('customerDetails')
    // Orders were not granted.
    expect(names).not.toContain('pendingOrders')
    expect(names).not.toContain('proposeOrderNote')

    const found = await rpc(m.slug, t.access_token, 'tools/call', {
      name: 'findProducts',
      arguments: { search: 'glide' },
    })
    expect(found.body?.result.isError).toBe(false)
    expect(found.body?.result.content[0].text).toContain('Glide Mouse')

    // Customer details are off by default: refused and logged as blocked.
    await owner
      .insert(customer)
      .values({ storeId: m.storeId, email: 'riya@example.com', name: 'Riya' })
    const blocked = await rpc(m.slug, t.access_token, 'tools/call', {
      name: 'customerDetails',
      arguments: { email: 'riya@example.com' },
    })
    expect(blocked.body?.result.isError).toBe(true)

    // The owner never needs approval: an ordinary change runs at once, as the AI bar's would.
    const made = await rpc(m.slug, t.access_token, 'tools/call', {
      name: 'proposeDiscount',
      arguments: { code: 'MCP10', type: 'percent', value: 10 },
    })
    expect(made.body?.result.isError).toBe(false)
    const [action] = await owner.select().from(aiAction).where(eq(aiAction.storeId, m.storeId))
    expect(action).toMatchObject({ source: 'mcp', status: 'executed', userId: m.userId })
    expect(await owner.select().from(discount).where(eq(discount.storeId, m.storeId))).toHaveLength(
      1,
    )

    const log = await call(appRouter.apiAccess.activity, { filter: 'all' }, { context: m.ctx })
    const kinds = log.items.map((i) => i.kind)
    expect(kinds).toEqual(expect.arrayContaining(['connected', 'read', 'blocked', 'change']))
  })

  it('runs a change at once, and reads customers when allowed', async () => {
    const m = await merchant('asha@example.com', 'asha')
    await call(
      appRouter.apiAccess.saveSettings,
      { allowChanges: true, readCustomers: true },
      { context: m.ctx },
    )
    const t = await connect(m)
    const done = await rpc(m.slug, t.access_token, 'tools/call', {
      name: 'proposeDiscount',
      arguments: { code: 'NOW10', type: 'percent', value: 10 },
    })
    expect(done.body?.result.isError).toBe(false)
    const rows = await owner.select().from(discount).where(eq(discount.storeId, m.storeId))
    expect(rows).toHaveLength(1)

    await owner
      .insert(customer)
      .values({ storeId: m.storeId, email: 'riya@example.com', name: 'Riya' })
    const read = await rpc(m.slug, t.access_token, 'tools/call', {
      name: 'customerDetails',
      arguments: { email: 'riya@example.com' },
    })
    expect(read.body?.result.content[0].text).toContain('Riya')
  })

  it('hides change tools when changes are off', async () => {
    const m = await merchant('asha@example.com', 'asha')
    await call(
      appRouter.apiAccess.saveSettings,
      { allowChanges: false, readCustomers: false },
      { context: m.ctx },
    )
    const t = await connect(m)
    const list = await rpc(m.slug, t.access_token, 'tools/list')
    const names = ((list.body?.result?.tools ?? []) as { name: string }[]).map((x) => x.name)
    expect(names).not.toContain('proposeDiscount')
    const tried = await rpc(m.slug, t.access_token, 'tools/call', {
      name: 'proposeDiscount',
      arguments: { code: 'NO10', value: 10 },
    })
    expect(tried.body?.result.isError).toBe(true)
  })

  it('rotates refresh tokens, and a revoked client is locked out', async () => {
    const m = await merchant('asha@example.com', 'asha')
    const t = await connect(m)
    const refresh = (token: string) =>
      handleToken(
        new Request(`${ORIGIN}/api/oauth/token`, {
          method: 'POST',
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: token,
            client_id: t.clientId,
          }),
        }),
        host,
      )
    const first = await refresh(t.refresh_token)
    expect(first.status).toBe(200)
    const next = (await first.json()) as { access_token: string }
    expect((await refresh(t.refresh_token)).status).toBe(400)
    expect((await rpc(m.slug, t.access_token, 'ping')).res.status).toBe(401)
    expect((await rpc(m.slug, next.access_token, 'ping')).res.status).toBe(200)

    const grants = await call(appRouter.apiAccess.grants, undefined, { context: m.ctx })
    expect(grants.clients).toHaveLength(1)
    await call(
      appRouter.apiAccess.revoke,
      { id: grants.clients[0]?.id as string },
      { context: m.ctx },
    )
    expect((await rpc(m.slug, next.access_token, 'ping')).res.status).toBe(401)
  })

  it('never answers for another store', async () => {
    const a = await merchant('asha@example.com', 'asha')
    await merchant('bina@example.com', 'bina')
    const t = await connect(a)
    expect((await rpc('bina', t.access_token, 'ping')).res.status).toBe(401)
  })

  it('refuses a code used twice or with the wrong verifier', async () => {
    const m = await merchant('asha@example.com', 'asha')
    const reg = await handleRegister(
      new Request(`${ORIGIN}/api/oauth/register`, {
        method: 'POST',
        body: JSON.stringify({ client_name: 'Cursor', redirect_uris: ['cursor://anysphere/cb'] }),
      }),
      host,
    )
    const { client_id } = (await reg.json()) as { client_id: string }
    const verifier = randomBytes(32).toString('base64url')
    const back = new URL(
      await decideAuthorize(app, ORIGIN, {
        params: {
          response_type: 'code',
          client_id,
          redirect_uri: 'cursor://anysphere/cb',
          code_challenge: createHash('sha256').update(verifier).digest('base64url'),
          code_challenge_method: 'S256',
          resource: `${ORIGIN}/api/mcp/${m.slug}`,
        },
        userId: m.userId,
        slug: m.slug,
        scopes: { products: 'read' },
        allow: true,
      }),
    )
    const swap = (v: string) =>
      handleToken(
        new Request(`${ORIGIN}/api/oauth/token`, {
          method: 'POST',
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: back.searchParams.get('code') as string,
            redirect_uri: 'cursor://anysphere/cb',
            client_id,
            code_verifier: v,
          }),
        }),
        host,
      )
    expect((await swap(randomBytes(32).toString('base64url'))).status).toBe(400)
    expect((await swap(verifier)).status).toBe(200)
    expect((await swap(verifier)).status).toBe(400)
  })

  it('rejects script-carrying redirect addresses at registration', async () => {
    const reg = await handleRegister(
      new Request(`${ORIGIN}/api/oauth/register`, {
        method: 'POST',
        body: JSON.stringify({ client_name: 'Bad', redirect_uris: ['javascript:alert(1)'] }),
      }),
      host,
    )
    expect(reg.status).toBe(400)
  })
})

describe('access tokens', () => {
  it('act as their member, capped to their areas, and never reach session-only procedures', async () => {
    const m = await merchant('asha@example.com', 'asha')
    await seedProduct(m.storeId, 'Glide Mouse')
    const created = await call(
      appRouter.apiAccess.createToken,
      { name: 'Inventory sync script', scopes: { products: 'read' }, expiresInDays: 90 },
      { context: m.ctx },
    )
    expect(created.token.startsWith('kmc_live_')).toBe(true)
    expect(created.grant.hint).toBe(`kmc_…${created.token.slice(-4)}`)

    const auth1 = await authenticateApiToken(app, created.token)
    if (!auth1.ok) throw new Error('token did not authenticate')
    const api = ctx(new Headers(), { apiPrincipal: auth1.principal })

    const list = await call(appRouter.products.list, {}, { context: api })
    expect(list.items.map((p: { title: string }) => p.title)).toContain('Glide Mouse')
    await expect(
      call(appRouter.discounts.create, { code: 'X' } as never, { context: api }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      call(appRouter.account.profile, undefined, { context: api }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(
      call(appRouter.apiAccess.grants, undefined, { context: api }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })

    // The call is in the activity log once, however often a script repeats it.
    await call(appRouter.products.list, {}, { context: api })
    const reads = await owner
      .select()
      .from(apiActivity)
      .where(and(eq(apiActivity.storeId, m.storeId), eq(apiActivity.kind, 'read')))
    expect(reads).toHaveLength(1)
  })

  it('stop working once expired or revoked', async () => {
    const m = await merchant('asha@example.com', 'asha')
    const created = await call(
      appRouter.apiAccess.createToken,
      { name: 'Tally export', scopes: { orders: 'read' }, expiresInDays: 30 },
      { context: m.ctx },
    )
    const later = new Date(Date.now() + 31 * 86_400_000)
    expect(await authenticateApiToken(app, created.token, { now: later })).toEqual({
      ok: false,
      reason: 'expired',
    })
    await call(appRouter.apiAccess.revoke, { id: created.grant.id }, { context: m.ctx })
    expect(await authenticateApiToken(app, created.token)).toEqual({ ok: false, reason: 'invalid' })
  })
})
