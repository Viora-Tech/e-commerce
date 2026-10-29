import { createHash, randomBytes } from 'node:crypto'
import { createMerchantAuth } from '@commerce/auth'
import { type ApiScopes, createMemoryRateLimitStore } from '@commerce/core'
import {
  aiAction,
  apiActivity,
  createDb,
  discount,
  product,
  role,
  store,
  storeMember,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { handleMcpDownload } from '../src/mcp/download-link'
import { decideAuthorize, handleRegister, handleToken } from '../src/mcp/oauth'
import { handleMcpRequest } from '../src/mcp/server'
import { appRouter } from '../src/routers/_app'

/*
 * MCP searchActions / describeAction / runAction end to end: what a client can find, what it
 * may run, when a change waits in AI approvals, that approving runs it as the approver, and
 * that every call leaves a row in Settings → MCP & API → Activity.
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
const routerDeps = () => ({
  db: app,
  auth,
  notifications: { add: async () => undefined },
  rateLimit,
})
const host = { db: app, origin: ORIGIN, rateLimit, api: routerDeps }

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

const ctx = (headers: Headers): ApiContext => ({ ...routerDeps(), headers })

async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: `Store ${slug}`, organizationId: org?.id as string })
    .returning()
  const session = await auth.api.getSession({ headers })
  await call(appRouter.staff.me, {}, { context: ctx(headers) })
  return {
    ctx: ctx(headers),
    storeId: s?.id as string,
    organizationId: org?.id as string,
    userId: session?.user.id as string,
    slug,
  }
}

type Merchant = Awaited<ReturnType<typeof merchant>>

/** A second member on the system `staff` role: orders and stock, no discount writes. */
async function staffOf(boss: Merchant, email = 'helper@example.com') {
  const headers = await signIn(email)
  const userId = (await auth.api.getSession({ headers }))?.user.id as string
  await auth.api.addMember({
    body: { userId, role: 'member', organizationId: boss.organizationId },
  })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: boss.organizationId } })
  const [r] = await owner
    .select()
    .from(role)
    .where(and(eq(role.storeId, boss.storeId), eq(role.slug, 'staff')))
  await owner.insert(storeMember).values({ storeId: boss.storeId, userId, roleId: r?.id as string })
  return { ...boss, ctx: ctx(headers), userId }
}

/** Signs a client in the way Claude does (PKCE) with these areas; returns its access token. */
async function connect(m: { userId: string; slug: string }, scopes: ApiScopes) {
  const reg = await handleRegister(
    new Request(`${ORIGIN}/api/oauth/register`, {
      method: 'POST',
      body: JSON.stringify({
        client_name: 'Claude',
        redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      }),
    }),
    host,
  )
  const client = (await reg.json()) as { client_id: string }
  const verifier = randomBytes(32).toString('base64url')
  const params = {
    response_type: 'code',
    client_id: client.client_id,
    redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    resource: `${ORIGIN}/api/mcp/${m.slug}`,
  }
  const back = new URL(
    await decideAuthorize(app, ORIGIN, {
      params,
      userId: m.userId,
      slug: m.slug,
      scopes,
      allow: true,
    }),
  )
  const token = await handleToken(
    new Request(`${ORIGIN}/api/oauth/token`, {
      method: 'POST',
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
  return ((await token.json()) as { access_token: string }).access_token
}

/** One `tools/call`; answers the tool's result. */
async function tool(slug: string, token: string, name: string, args: unknown) {
  const res = await handleMcpRequest(
    new Request(`${ORIGIN}/api/mcp/${slug}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    }),
    slug,
    host,
  )
  const body = (await res.json()) as {
    // biome-ignore lint/suspicious/noExplicitAny: a JSON-RPC answer read field by field in assertions
    result: { isError: boolean; content: { text: string }[]; structuredContent?: any }
  }
  return { ...body.result, text: body.result.content[0]?.text ?? '' }
}

const settings = (m: Merchant, requireApproval: boolean) =>
  call(
    appRouter.apiAccess.saveSettings,
    { allowChanges: true, requireApproval, readCustomers: false },
    { context: m.ctx },
  )

const activity = (storeId: string) =>
  owner.select().from(apiActivity).where(eq(apiActivity.storeId, storeId))

const discountInput = { title: 'MCP', kind: 'code', code: 'MCP10', method: 'percent', value: 1000 }

describe('MCP admin actions', () => {
  it('lists the three tools, searches only granted areas and never shows excluded actions', async () => {
    const m = await merchant('asha@example.com', 'asha')
    const t = await connect(m, { orders: 'write', settings: 'write' })
    const res = await handleMcpRequest(
      new Request(`${ORIGIN}/api/mcp/${m.slug}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
      m.slug,
      host,
    )
    const names = (
      (await res.json()) as { result: { tools: { name: string }[] } }
    ).result.tools.map((x) => x.name)
    expect(names).toEqual(expect.arrayContaining(['searchActions', 'describeAction', 'runAction']))

    const found = await tool(m.slug, t, 'searchActions', { query: 'fulfil order' })
    const paths = (found.structuredContent.actions as { path: string }[]).map((a) => a.path)
    expect(paths).toContain('orders.fulfil')
    expect(paths.length).toBeLessThanOrEqual(20)

    const products = await tool(m.slug, t, 'searchActions', { query: 'product' })
    expect(
      (products.structuredContent.actions as { area: string }[]).every(
        (a) => a.area !== 'products',
      ),
    ).toBe(true)

    for (const query of ['token', 'session', 'approve', 'sign in']) {
      const r = await tool(m.slug, t, 'searchActions', { query })
      const hits = (r.structuredContent.actions as { path: string }[]).map((a) => a.path)
      expect(hits).not.toContain('apiAccess.createToken')
      expect(hits).not.toContain('apiAccess.revoke')
      expect(hits).not.toContain('ai.approveAction')
      expect(hits.some((p) => p.startsWith('account.'))).toBe(false)
    }

    const described = await tool(m.slug, t, 'describeAction', { path: 'orders.refund' })
    expect(described.structuredContent).toMatchObject({
      kind: 'sensitive',
      needsApproval: 'always',
    })
    expect(described.structuredContent.inputSchema.type).toBe('object')

    for (const path of ['apiAccess.createToken', 'account.sessions', 'ai.approveAction']) {
      const r = await tool(m.slug, t, 'runAction', { path, input: {} })
      expect(r.isError).toBe(true)
      expect(r.text).toContain('There is no action')
    }
    const rows = await activity(m.storeId)
    expect(rows.filter((r) => r.kind === 'blocked').map((r) => r.tool)).toEqual(
      expect.arrayContaining(['apiAccess.createToken', 'account.sessions']),
    )
    expect(rows.some((r) => r.kind === 'read' && r.tool === 'searchActions')).toBe(true)
  })

  it('refuses outside the grant, and the role through the admin middleware', async () => {
    const m = await merchant('asha@example.com', 'asha')
    await settings(m, false)
    const t = await connect(m, { products: 'read' })
    const outside = await tool(m.slug, t, 'runAction', {
      path: 'discounts.create',
      input: discountInput,
    })
    expect(outside.text).toContain('not given access to discounts')
    const readOnly = await tool(m.slug, t, 'runAction', {
      path: 'products.generateHandle',
      input: { title: 'x' },
    })
    expect(readOnly.isError).toBe(true)

    // The staff role holds no discount writes: the grant allows it, the role does not.
    const s = await staffOf(m)
    const st = await connect(s, { discounts: 'write' })
    const refused = await tool(s.slug, st, 'runAction', {
      path: 'discounts.create',
      input: discountInput,
    })
    expect(refused.isError).toBe(true)
    expect(refused.text).toMatch(/role does not allow/i)
    expect(await owner.select().from(discount).where(eq(discount.storeId, m.storeId))).toEqual([])
    const blocked = (await activity(m.storeId)).filter((r) => r.kind === 'blocked')
    expect(blocked.map((r) => r.tool)).toEqual(expect.arrayContaining(['discounts.create']))
  })

  it('runs reads and (approval off) changes at once, logging the action path', async () => {
    const m = await merchant('asha@example.com', 'asha')
    await settings(m, false)
    const t = await connect(m, { discounts: 'write' })
    const made = await tool(m.slug, t, 'runAction', {
      path: 'discounts.create',
      input: discountInput,
    })
    expect(made.isError).toBe(false)
    expect(await owner.select().from(discount).where(eq(discount.storeId, m.storeId))).toHaveLength(
      1,
    )
    const listed = await tool(m.slug, t, 'runAction', { path: 'discounts.list', input: {} })
    expect(listed.text).toContain('MCP10')
    const rows = await activity(m.storeId)
    expect(rows.find((r) => r.kind === 'change')?.tool).toBe('discounts.create')
    expect(rows.find((r) => r.kind === 'read' && r.tool === 'discounts.list')).toBeTruthy()
  })

  it('queues changes while approval is on, and sensitive ones always; approving runs them', async () => {
    const m = await merchant('asha@example.com', 'asha')
    const t = await connect(m, { discounts: 'write' })
    const queued = await tool(m.slug, t, 'runAction', {
      path: 'discounts.create',
      input: discountInput,
    })
    expect(queued.text).toContain('Waiting for approval')
    expect(await owner.select().from(discount).where(eq(discount.storeId, m.storeId))).toEqual([])
    const [pending] = await owner.select().from(aiAction).where(eq(aiAction.storeId, m.storeId))
    expect(pending).toMatchObject({ tool: 'runAdminAction', source: 'mcp', status: 'proposed' })
    const card = await call(appRouter.ai.action, { id: pending?.id as string }, { context: m.ctx })
    expect(card.preview.title).toBe('Discounts: create')
    expect(card.preview.rows).toEqual(
      expect.arrayContaining([{ label: 'Code', before: '', after: 'MCP10' }]),
    )
    const done = await call(
      appRouter.ai.approveAction,
      { id: pending?.id as string },
      { context: m.ctx },
    )
    expect(done.status).toBe('executed')
    const [made] = await owner.select().from(discount).where(eq(discount.storeId, m.storeId))
    expect(made?.code).toBe('MCP10')

    // Approval off: a delete still waits.
    await settings(m, false)
    const del = await tool(m.slug, t, 'runAction', {
      path: 'discounts.delete',
      input: { id: made?.id },
    })
    expect(del.text).toContain('Sensitive actions always wait')
    expect(await owner.select().from(discount).where(eq(discount.storeId, m.storeId))).toHaveLength(
      1,
    )
    const rows = await activity(m.storeId)
    expect(rows.filter((r) => r.kind === 'approval').map((r) => r.tool)).toEqual(
      expect.arrayContaining(['discounts.create', 'discounts.delete']),
    )
  })

  it('runs an approved action as the approver, so their role decides', async () => {
    const m = await merchant('asha@example.com', 'asha')
    const s = await staffOf(m)
    const st = await connect(s, { discounts: 'write' })
    await tool(s.slug, st, 'runAction', { path: 'discounts.create', input: discountInput })
    const [pending] = await owner.select().from(aiAction).where(eq(aiAction.storeId, m.storeId))
    const id = pending?.id as string
    // The staff member who connected cannot make it: refused, and it keeps waiting.
    await expect(
      call(appRouter.ai.approveAction, { id }, { context: s.ctx }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: expect.stringMatching(/permission|role/i),
    })
    expect(await owner.select().from(discount).where(eq(discount.storeId, m.storeId))).toEqual([])
    const [still] = await owner.select().from(aiAction).where(eq(aiAction.id, id))
    expect(still?.status).toBe('proposed')
  })

  it("lets the owner approve another member's MCP proposal, as the owner", async () => {
    const m = await merchant('asha@example.com', 'asha')
    const s = await staffOf(m)
    const st = await connect(s, { discounts: 'write' })
    await tool(s.slug, st, 'runAction', { path: 'discounts.create', input: discountInput })
    const [pending] = await owner.select().from(aiAction).where(eq(aiAction.storeId, m.storeId))
    const id = pending?.id as string
    expect(pending?.userId).toBe(s.userId)

    const card = await call(appRouter.ai.action, { id }, { context: m.ctx })
    expect(card.status).toBe('proposed')
    expect(card.requestedBy).toBeTruthy()
    expect(card.by).toBeNull()

    const done = await call(appRouter.ai.approveAction, { id }, { context: m.ctx })
    expect(done.status).toBe('executed')
    expect(done.by).toBe('asha@example.com')
    expect(done.requestedBy).toBe(card.requestedBy)
    const [row] = await owner.select().from(aiAction).where(eq(aiAction.id, id))
    expect(row).toMatchObject({ status: 'executed', approvedBy: m.userId, userId: s.userId })
    const [made] = await owner.select().from(discount).where(eq(discount.storeId, m.storeId))
    expect(made?.code).toBe('MCP10')

    const log = await call(appRouter.apiAccess.activity, { filter: 'approval' }, { context: m.ctx })
    expect(log.items[0]).toMatchObject({ approvalId: null, approvalStatus: 'executed' })
  })

  it("refuses a member whose role lacks the permission, and keeps others' assistant cards theirs", async () => {
    const m = await merchant('asha@example.com', 'asha')
    const s = await staffOf(m)
    const t = await connect(m, { discounts: 'write' })
    await tool(m.slug, t, 'runAction', { path: 'discounts.create', input: discountInput })
    const [pending] = await owner.select().from(aiAction).where(eq(aiAction.storeId, m.storeId))
    const id = pending?.id as string

    // Staff holds no discount writes: approving is refused by the admin middleware, and only
    // the owner may cancel or edit it for the member who asked.
    await expect(
      call(appRouter.ai.approveAction, { id }, { context: s.ctx }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(call(appRouter.ai.cancelAction, { id }, { context: s.ctx })).rejects.toMatchObject(
      { code: 'FORBIDDEN' },
    )
    expect(await owner.select().from(discount).where(eq(discount.storeId, m.storeId))).toEqual([])
    const [still] = await owner.select().from(aiAction).where(eq(aiAction.id, id))
    expect(still).toMatchObject({ status: 'proposed', approvedBy: null })

    // An AI bar proposal stays the asker's own, even for the owner.
    await owner
      .update(aiAction)
      .set({ source: 'assistant', userId: s.userId })
      .where(eq(aiAction.id, id))
    await expect(
      call(appRouter.ai.approveAction, { id }, { context: m.ctx }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: expect.stringMatching(/asked the assistant/),
    })
  })

  it('refuses an expired proposal with a clear message, and shows it as expired', async () => {
    const m = await merchant('asha@example.com', 'asha')
    const s = await staffOf(m)
    const st = await connect(s, { discounts: 'write' })
    await tool(s.slug, st, 'runAction', { path: 'discounts.create', input: discountInput })
    const [pending] = await owner.select().from(aiAction).where(eq(aiAction.storeId, m.storeId))
    const id = pending?.id as string
    await owner
      .update(aiAction)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(aiAction.id, id))

    await expect(
      call(appRouter.ai.approveAction, { id }, { context: m.ctx }),
    ).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringMatching(/expired/) })
    expect(await owner.select().from(discount).where(eq(discount.storeId, m.storeId))).toEqual([])

    const card = await call(appRouter.ai.action, { id }, { context: m.ctx })
    expect(card).toMatchObject({ status: 'expired', editable: [] })
    const log = await call(appRouter.apiAccess.activity, { filter: 'approval' }, { context: m.ctx })
    expect(log.items[0]).toMatchObject({ approvalId: null, approvalStatus: 'expired' })
    const list = await call(appRouter.ai.activity, {}, { context: m.ctx })
    expect(list.items[0]).toMatchObject({ id, status: 'expired' })
    expect(list.items[0]?.requestedBy).toBeTruthy()
  })

  it('answers files with a signed link, and cuts long answers', async () => {
    const m = await merchant('asha@example.com', 'asha')
    const t = await connect(m, { online_store: 'write', products: 'read' })
    await call(appRouter.redirects.save, { path: '/old', target: '/new' }, { context: m.ctx })
    const file = await tool(m.slug, t, 'runAction', { path: 'redirects.exportCsv', input: {} })
    const url = file.structuredContent.file.url as string
    expect(url).toContain(`/api/mcp/${m.slug}/download?t=`)
    const res = await handleMcpDownload(new Request(url), m.slug, host)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('/old')
    const forged = await handleMcpDownload(new Request(`${url}x`), m.slug, host)
    expect(forged.status).toBe(410)

    const long = 'Glide '.repeat(40)
    await owner.insert(product).values(
      Array.from({ length: 100 }, (_, i) => ({
        storeId: m.storeId,
        handle: `p-${i}`,
        title: `${long}${i}`,
        status: 'active' as const,
      })),
    )
    const big = await tool(m.slug, t, 'runAction', {
      path: 'products.list',
      input: { perPage: 100 },
    })
    expect(big.text).toContain('[truncated:')
    expect(big.text.length).toBeLessThan(20_300)

    const huge = await tool(m.slug, t, 'runAction', {
      path: 'products.list',
      input: { search: 'x'.repeat(40_000) },
    })
    expect(huge.text).toContain('too large')
  })
})
