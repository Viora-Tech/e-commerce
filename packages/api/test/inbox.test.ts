import { createMerchantAuth } from '@commerce/auth'
import { SYSTEM_ROLES } from '@commerce/core'
import { createDb, inboxConversation, inboxMessage, store } from '@commerce/db'
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

async function install(storeId: string) {
  await owner
    .update(store)
    .set({ apps: { installed: ['inbox'] } })
    .where(eq(store.id, storeId))
}

async function conversationIn(storeId: string, body: string) {
  const [c] = await owner
    .insert(inboxConversation)
    .values({ storeId, visitorKeyHash: `v-${body}`, unreadStaff: 1, lastMessagePreview: body })
    .returning()
  await owner
    .insert(inboxMessage)
    .values({ storeId, conversationId: c?.id as string, sender: 'shopper', body })
  return c?.id as string
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('inbox router', () => {
  it('refuses until the Inbox app is installed', async () => {
    const m = await merchant('a@example.com', 'store-a')
    await expect(call(appRouter.inbox.counts, undefined, { context: m.ctx })).rejects.toThrow(
      /Install the Inbox app/,
    )
  })

  it('lists, opens, replies, closes; another store’s id is not found', async () => {
    const m = await merchant('b@example.com', 'store-b')
    const other = await merchant('c@example.com', 'store-c')
    await install(m.storeId)
    await install(other.storeId)
    const id = await conversationIn(m.storeId, 'Is COD available?')
    const foreign = await conversationIn(other.storeId, 'Other store')

    expect(await call(appRouter.inbox.counts, undefined, { context: m.ctx })).toMatchObject({
      open: 1,
      unread: 1,
    })
    const list = await call(appRouter.inbox.list, { view: 'open' }, { context: m.ctx })
    expect(list.rows.map((r) => r.id)).toEqual([id])

    const reply = await call(
      appRouter.inbox.send,
      { conversationId: id, body: 'Yes, across India', clientId: 'staff-client-1' },
      { context: m.ctx },
    )
    expect(reply.message).toMatchObject({ sender: 'staff', body: 'Yes, across India' })
    const thread = await call(appRouter.inbox.get, { id }, { context: m.ctx })
    expect(thread.messages.map((x) => x.body)).toEqual(['Is COD available?', 'Yes, across India'])
    expect(thread.conversation.unreadStaff).toBe(0)

    await call(appRouter.inbox.setStatus, { id, status: 'closed' }, { context: m.ctx })
    expect(await call(appRouter.inbox.counts, undefined, { context: m.ctx })).toMatchObject({
      open: 0,
      closed: 1,
    })
    await expect(call(appRouter.inbox.get, { id: foreign }, { context: m.ctx })).rejects.toThrow(
      /not found/,
    )
    await expect(
      call(appRouter.inbox.send, { conversationId: foreign, body: 'x' }, { context: m.ctx }),
    ).rejects.toThrow(/not found/)
  })

  it('quick replies and settings', async () => {
    const m = await merchant('d@example.com', 'store-d')
    await install(m.storeId)
    await call(
      appRouter.inbox.quickReplies.create,
      { title: 'Delivery', body: '3 to 5 days', shortcut: 'delivery' },
      { context: m.ctx },
    )
    await expect(
      call(
        appRouter.inbox.quickReplies.create,
        { title: 'Again', body: 'x', shortcut: '/Delivery' },
        { context: m.ctx },
      ),
    ).rejects.toThrow(/already used/)
    const saved = await call(
      appRouter.inbox.settings.save,
      { greeting: 'Namaste!' },
      { context: m.ctx },
    )
    expect(saved).toMatchObject({ greeting: 'Namaste!', requireSignIn: false })
    const got = await call(appRouter.inbox.settings.get, undefined, { context: m.ctx })
    expect(got.settings.greeting).toBe('Namaste!')
  })
})

describe('inbox realtime', () => {
  it('publishes after the write commits, and nothing when it fails', async () => {
    const m = await merchant('e@example.com', 'store-e')
    await install(m.storeId)
    const id = await conversationIn(m.storeId, 'Hello?')
    const published: { channel: string; event: { type: string } }[] = []
    const ctx = {
      ...m.ctx,
      inboxPublisher: {
        publish: async (channel: string, message: string) => {
          published.push({ channel, event: JSON.parse(message) })
        },
      },
    } as ApiContext
    await call(appRouter.inbox.send, { conversationId: id, body: 'Hi there' }, { context: ctx })
    expect(published.map((p) => `${p.channel.split(':')[0]} ${p.event.type}`)).toEqual([
      'inbox message',
      'inbox conversation',
      'conv message',
    ])
    published.length = 0
    await call(
      appRouter.inbox.send,
      { conversationId: id, kind: 'note', body: 'psst' },
      { context: ctx },
    )
    expect(published.some((p) => p.channel.startsWith('conv:'))).toBe(false)
    published.length = 0
    await expect(
      call(appRouter.inbox.send, { conversationId: id, kind: 'discount' }, { context: ctx }),
    ).rejects.toThrow(/discount/)
    expect(published).toEqual([])
    await call(appRouter.inbox.typing, { id }, { context: ctx })
    await call(appRouter.inbox.typing, { id }, { context: ctx })
    expect(published.map((p) => p.event.type)).toEqual(['typing'])
  })

  it('sync catches up from a cursor; the stream check needs the app', async () => {
    const m = await merchant('f@example.com', 'store-f')
    await expect(call(appRouter.inbox.streamAccess, undefined, { context: m.ctx })).rejects.toThrow(
      /Install/,
    )
    await install(m.storeId)
    expect(await call(appRouter.inbox.streamAccess, undefined, { context: m.ctx })).toEqual({
      storeId: m.storeId,
    })
    const id = await conversationIn(m.storeId, 'One')
    const start = await call(appRouter.inbox.sync, {}, { context: m.ctx })
    expect(start.cursor).not.toBeNull()
    await call(appRouter.inbox.send, { conversationId: id, body: 'Two' }, { context: m.ctx })
    const next = await call(appRouter.inbox.sync, { since: start.cursor }, { context: m.ctx })
    expect(next.messages.map((x) => x.body)).toContain('Two')
    expect(classifyAction('inbox.sync')).toBe('read')
    expect(classifyAction('inbox.streamAccess')).toBeNull()
  })
})

describe('inbox permissions', () => {
  it('admins get every inbox grant; the Staff role gets none', () => {
    const admin = SYSTEM_ROLES.find((r) => r.slug === 'admin')
    const staff = SYSTEM_ROLES.find((r) => r.slug === 'staff')
    expect(admin?.permissions).toEqual(
      expect.arrayContaining(['inbox.read', 'inbox.reply', 'inbox.manage']),
    )
    expect(staff?.permissions.some((p) => p.startsWith('inbox.'))).toBe(false)
  })

  it('MCP reads are reads; sending to a shopper always waits for approval', () => {
    expect(classifyAction('inbox.list')).toBe('read')
    expect(classifyAction('inbox.counts')).toBe('read')
    expect(classifyAction('inbox.get')).toBe('read')
    expect(classifyAction('inbox.send')).toBe('sensitive')
    expect(classifyAction('inbox.quickReplies.delete')).toBe('sensitive')
  })
})
