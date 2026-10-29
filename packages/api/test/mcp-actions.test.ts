import { createHash, randomBytes } from 'node:crypto'
import { createMerchantAuth } from '@commerce/auth'
import { type ApiScopes, createMemoryRateLimitStore } from '@commerce/core'
import {
  aiAction,
  apiActivity,
  createDb,
  discount,
  order,
  payment,
  product,
  refund,
  role,
  roleApproval,
  rolePermission,
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
 * may run (the member's role), that sensitive changes wait for a person, that approving runs it
 * as the approver, and
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

/**
 * A second member on a system role: `staff` (orders and stock, no discount writes) by default,
 * or `admin` (everything but billing and staff, with the default "Needs approval" ticks).
 */
async function staffOf(boss: Merchant, email = 'helper@example.com', slug = 'staff') {
  const headers = await signIn(email)
  const userId = (await auth.api.getSession({ headers }))?.user.id as string
  await auth.api.addMember({
    body: { userId, role: 'member', organizationId: boss.organizationId },
  })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: boss.organizationId } })
  const [r] = await owner
    .select()
    .from(role)
    .where(and(eq(role.storeId, boss.storeId), eq(role.slug, slug)))
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

/** A discount the owner made in the admin; answers its id. */
async function discountOf(m: Merchant) {
  await call(appRouter.discounts.create, discountInput, { context: m.ctx })
  const [row] = await owner.select().from(discount).where(eq(discount.storeId, m.storeId))
  return row?.id as string
}

const activity = (storeId: string) =>
  owner.select().from(apiActivity).where(eq(apiActivity.storeId, storeId))

const discountInput = {
  title: 'MCP',
  kind: 'code',
  code: 'MCP10',
  method: 'percent',
  value: 1000,
} as const

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

  it("runs reads and changes at once with the member's role, logging the action path", async () => {
    const m = await merchant('asha@example.com', 'asha')
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

  it('queues sensitive actions for a person even for the owner; approving runs them', async () => {
    const m = await merchant('asha@example.com', 'asha')
    const t = await connect(m, { discounts: 'write' })
    const made = await discountOf(m)
    const del = await tool(m.slug, t, 'runAction', {
      path: 'discounts.delete',
      input: { id: made },
    })
    expect(del.text).toContain('Sensitive actions always wait')
    const [pending] = await owner.select().from(aiAction).where(eq(aiAction.storeId, m.storeId))
    expect(pending).toMatchObject({ tool: 'runAdminAction', source: 'mcp', status: 'proposed' })
    const card = await call(appRouter.ai.action, { id: pending?.id as string }, { context: m.ctx })
    expect(card.preview.title).toBe('Discounts: delete')
    // The owner confirms their own AI app's sensitive action in the admin.
    const done = await call(
      appRouter.ai.approveAction,
      { id: pending?.id as string },
      { context: m.ctx },
    )
    expect(done).toMatchObject({ status: 'executed', confirmedAi: true })
    const rows = await activity(m.storeId)
    expect(rows.filter((r) => r.kind === 'approval').map((r) => r.tool)).toEqual([
      'discounts.delete',
    ])
  })

  it('runs an approved action as the approver, so their role decides', async () => {
    const m = await merchant('asha@example.com', 'asha')
    const s = await staffOf(m)
    const st = await connect(s, { discounts: 'write' })
    const made = await discountOf(m)
    await tool(s.slug, st, 'runAction', { path: 'discounts.delete', input: { id: made } })
    const [pending] = await owner.select().from(aiAction).where(eq(aiAction.storeId, m.storeId))
    const id = pending?.id as string
    // The staff member who connected cannot make it: refused, and it keeps waiting.
    await expect(
      call(appRouter.ai.approveAction, { id }, { context: s.ctx }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const [still] = await owner.select().from(aiAction).where(eq(aiAction.id, id))
    expect(still?.status).toBe('proposed')
    expect(await owner.select().from(discount).where(eq(discount.storeId, m.storeId))).toHaveLength(
      1,
    )
  })

  it("lets the owner approve another member's MCP proposal, as the owner", async () => {
    const m = await merchant('asha@example.com', 'asha')
    const s = await staffOf(m)
    const st = await connect(s, { discounts: 'write' })
    const made = await discountOf(m)
    await tool(s.slug, st, 'runAction', { path: 'discounts.delete', input: { id: made } })
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
    expect(await owner.select().from(discount).where(eq(discount.storeId, m.storeId))).toEqual([])

    const log = await call(appRouter.apiAccess.activity, { filter: 'approval' }, { context: m.ctx })
    expect(log.items[0]).toMatchObject({ approvalId: null, approvalStatus: 'executed' })
  })

  it("refuses a member whose role lacks the permission, and keeps others' assistant cards theirs", async () => {
    const m = await merchant('asha@example.com', 'asha')
    const s = await staffOf(m)
    const t = await connect(m, { discounts: 'write' })
    const made = await discountOf(m)
    await tool(m.slug, t, 'runAction', { path: 'discounts.delete', input: { id: made } })
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
    const made = await discountOf(m)
    await tool(s.slug, st, 'runAction', { path: 'discounts.delete', input: { id: made } })
    const [pending] = await owner.select().from(aiAction).where(eq(aiAction.storeId, m.storeId))
    const id = pending?.id as string
    await owner
      .update(aiAction)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(aiAction.id, id))

    await expect(
      call(appRouter.ai.approveAction, { id }, { context: m.ctx }),
    ).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringMatching(/expired/) })
    expect(await owner.select().from(discount).where(eq(discount.storeId, m.storeId))).toHaveLength(
      1,
    )

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

describe('role approvals', () => {
  // `path` as the RPC handler passes it: a role's ticks only hold back calls it can name.
  const create = (m: { ctx: ApiContext }, code = 'MCP10') =>
    call(
      appRouter.discounts.create,
      { ...discountInput, code },
      { context: m.ctx, path: ['discounts', 'create'] },
    )
  const discounts = (storeId: string) =>
    owner.select().from(discount).where(eq(discount.storeId, storeId))

  it('queues a ticked change from the admin for a different member, run as the owner', async () => {
    const m = await merchant('asha@example.com', 'asha')
    const a = await staffOf(m, 'admin@example.com', 'admin')
    const b = await staffOf(m, 'admin2@example.com', 'admin')

    // The admin role starts with discounts ticked: the change waits, nothing is made.
    await expect(create(a)).rejects.toMatchObject({
      code: 'APPROVAL_QUEUED',
      message: expect.stringMatching(/Sent for approval/),
    })
    expect(await discounts(m.storeId)).toEqual([])
    const [row] = await owner.select().from(aiAction).where(eq(aiAction.storeId, m.storeId))
    expect(row).toMatchObject({
      source: 'admin',
      tool: 'runAdminAction',
      status: 'proposed',
      needsApprover: true,
      permission: 'discounts.write',
      userId: a.userId,
    })
    const id = row?.id as string

    // Never the asker; nor another admin, whose own role ticks discounts.
    await expect(
      call(appRouter.ai.approveAction, { id }, { context: a.ctx }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: expect.stringMatching(/different/) })
    await expect(
      call(appRouter.ai.approveAction, { id }, { context: b.ctx }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await call(appRouter.approvals.waiting, undefined, { context: b.ctx })).toEqual([])
    expect(await call(appRouter.approvals.counts, undefined, { context: m.ctx })).toEqual({
      waiting: 1,
      outcomes: 0,
    })

    // Reads are never held back.
    await call(appRouter.discounts.list, {}, { context: a.ctx, path: ['discounts', 'list'] })

    const waiting = await call(appRouter.approvals.waiting, undefined, { context: m.ctx })
    expect(waiting.map((v) => v.id)).toEqual([id])
    expect(waiting[0]?.requestedBy).toBeTruthy()
    const done = await call(appRouter.ai.approveAction, { id }, { context: m.ctx })
    expect(done.status).toBe('executed')
    expect(await discounts(m.storeId)).toHaveLength(1)
    const [after] = await owner.select().from(aiAction).where(eq(aiAction.id, id))
    expect(after?.approvedBy).toBe(m.userId)

    // The asker hears the outcome: a badge until they open their requests.
    expect(await call(appRouter.approvals.counts, undefined, { context: a.ctx })).toEqual({
      waiting: 0,
      outcomes: 1,
    })
    const mine = await call(appRouter.approvals.mine, undefined, { context: a.ctx })
    expect(mine[0]).toMatchObject({ id, status: 'executed' })
    expect(await call(appRouter.approvals.counts, undefined, { context: a.ctx })).toEqual({
      waiting: 0,
      outcomes: 0,
    })
  })

  it('never holds the owner back, lets only the owner change ticks, and rejects record who', async () => {
    const m = await merchant('asha@example.com', 'asha')
    const a = await staffOf(m, 'admin@example.com', 'admin')
    await create(m, 'OWNER5')
    expect(await discounts(m.storeId)).toHaveLength(1)

    await expect(create(a)).rejects.toMatchObject({ code: 'APPROVAL_QUEUED' })
    const [row] = await owner.select().from(aiAction).where(eq(aiAction.storeId, m.storeId))
    const rejected = await call(
      appRouter.ai.cancelAction,
      { id: row?.id as string },
      { context: m.ctx },
    )
    expect(rejected).toMatchObject({ status: 'cancelled', by: 'asha@example.com' })

    const roles = await call(appRouter.staff.roles, undefined, { context: m.ctx })
    const adminRole = roles.find((r) => r.slug === 'admin')
    expect(adminRole?.needsApproval).toEqual(
      expect.arrayContaining(['orders.refund', 'discounts.write', 'payments.manage']),
    )
    expect(roles.find((r) => r.slug === 'owner')?.needsApproval).toEqual([])
    const rest = (adminRole?.needsApproval ?? []).filter((p) => p !== 'discounts.write')
    await expect(
      call(
        appRouter.staff.saveRoleApprovals,
        { roleId: adminRole?.id as string, permissions: rest },
        { context: a.ctx },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await call(
      appRouter.staff.saveRoleApprovals,
      { roleId: adminRole?.id as string, permissions: rest },
      { context: m.ctx },
    )
    await create(a, 'ADMIN5')
    expect(await discounts(m.storeId)).toHaveLength(2)
  })

  it('queues a ticked change an AI app makes for the member, and the asker can withdraw it', async () => {
    const m = await merchant('asha@example.com', 'asha')
    const a = await staffOf(m, 'admin@example.com', 'admin')
    const t = await connect(a, { discounts: 'write' })
    const queued = await tool(m.slug, t, 'runAction', {
      path: 'discounts.create',
      input: discountInput,
    })
    expect(queued.isError).toBe(false)
    expect(queued.text).toContain('Waiting for approval')
    const [row] = await owner.select().from(aiAction).where(eq(aiAction.storeId, m.storeId))
    expect(row).toMatchObject({ source: 'mcp', needsApprover: true, userId: a.userId })
    const rows = await activity(m.storeId)
    expect(rows.find((r) => r.kind === 'approval')?.aiActionId).toBe(row?.id)

    const withdrawn = await call(
      appRouter.ai.cancelAction,
      { id: row?.id as string },
      { context: a.ctx },
    )
    expect(withdrawn.status).toBe('cancelled')
    expect(await discounts(m.storeId)).toEqual([])
  })

  /** A custom role that may refund orders, with "Needs approval" ticked on refunds. */
  async function refundsRole(storeId: string) {
    const [r] = await owner
      .insert(role)
      .values({ storeId, name: 'Refunds', slug: 'refunds', isSystem: false })
      .returning()
    const roleId = r?.id as string
    await owner.insert(rolePermission).values(
      ['orders.read', 'orders.write', 'orders.refund'].map((permission) => ({
        storeId,
        roleId,
        permission,
      })),
    )
    await owner.insert(roleApproval).values({ storeId, roleId, permission: 'orders.refund' })
  }

  /** A paid (manual UPI) order; answers its payment's id. */
  async function paidOrder(storeId: string) {
    const [o] = await owner
      .insert(order)
      .values({
        storeId,
        number: 1,
        status: 'open',
        paymentMethod: 'manual',
        subtotalPaise: 50_000,
        totalPaise: 50_000,
        email: 'shopper@example.com',
      })
      .returning()
    const [p] = await owner
      .insert(payment)
      .values({
        storeId,
        orderId: o?.id as string,
        provider: 'manual',
        providerRef: 'ref_1',
        status: 'captured',
        amountPaise: 50_000,
      })
      .returning()
    return p?.id as string
  }

  it("queues a ticked staff refund; the owner approves it, the asker and a ticked admin can't", async () => {
    const m = await merchant('asha@example.com', 'asha')
    await refundsRole(m.storeId)
    const s = await staffOf(m, 'helper@example.com', 'refunds')
    const a = await staffOf(m, 'admin@example.com', 'admin')
    const paymentId = await paidOrder(m.storeId)
    const input = { paymentId, amountPaise: 10_000, manual: true }

    await expect(
      call(appRouter.orders.refund, input, { context: s.ctx, path: ['orders', 'refund'] }),
    ).rejects.toMatchObject({ code: 'APPROVAL_QUEUED' })
    expect(await owner.select().from(refund).where(eq(refund.storeId, m.storeId))).toEqual([])
    const [row] = await owner.select().from(aiAction).where(eq(aiAction.storeId, m.storeId))
    expect(row).toMatchObject({
      source: 'admin',
      needsApprover: true,
      permission: 'orders.refund',
      userId: s.userId,
    })
    const id = row?.id as string

    // The asker never approves their own request.
    await expect(
      call(appRouter.ai.approveAction, { id }, { context: s.ctx }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: expect.stringMatching(/different/) })
    // An admin whose own role ticks refunds (the default) may not approve it either.
    await expect(
      call(appRouter.ai.approveAction, { id }, { context: a.ctx }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await owner.select().from(refund).where(eq(refund.storeId, m.storeId))).toEqual([])

    const done = await call(appRouter.ai.approveAction, { id }, { context: m.ctx })
    expect(done).toMatchObject({ status: 'executed', confirmedAi: false })
    expect(await owner.select().from(refund).where(eq(refund.storeId, m.storeId))).toHaveLength(1)
  })

  it('lets an approver without the tick approve, and refuses people-only paths it cannot queue', async () => {
    const m = await merchant('asha@example.com', 'asha')
    const a = await staffOf(m, 'admin@example.com', 'admin')
    const b = await staffOf(m, 'admin2@example.com', 'admin')
    const roles = await call(appRouter.staff.roles, undefined, { context: m.ctx })
    const adminRole = roles.find((r) => r.slug === 'admin')
    expect(adminRole?.permissions).toEqual(
      expect.arrayContaining(['approvals.manage', 'payments.manage']),
    )
    expect(adminRole?.needsApproval).not.toContain('settings.manage')

    await expect(create(a)).rejects.toMatchObject({ code: 'APPROVAL_QUEUED' })
    const [row] = await owner.select().from(aiAction).where(eq(aiAction.storeId, m.storeId))
    // B's role is changed by the owner to drop the discounts tick: now B may approve A's.
    await call(
      appRouter.staff.saveRoleApprovals,
      {
        roleId: adminRole?.id as string,
        permissions: (adminRole?.needsApproval ?? []).filter((p) => p !== 'discounts.write'),
      },
      { context: m.ctx },
    )
    const done = await call(
      appRouter.ai.approveAction,
      { id: row?.id as string },
      { context: b.ctx },
    )
    expect(done.status).toBe('executed')
    expect(await discounts(m.storeId)).toHaveLength(1)

    // A browser hand-off behind a ticked permission cannot wait: refused, nothing queued.
    await expect(
      call(
        appRouter.payments.razorpayOAuthStart,
        { mode: 'test' },
        { context: a.ctx, path: ['payments', 'razorpayOAuthStart'] },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: expect.stringMatching(/cannot wait/) })
    expect(await owner.select().from(aiAction).where(eq(aiAction.storeId, m.storeId))).toHaveLength(
      1,
    )
  })
})
