/** SOURCE OF TRUTH: Inbox service tests — WHAT: conversation access per store and per shopper, guest → customer merge, idempotent sends, the replay query, spam and blocks, rate limits, the shopper side / WHY: a shopper must never read another shopper's thread, and one store never another's */
import { createDb, customer, inboxConversation, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import { createMemoryRateLimitStore } from '../rate-limit/memory-store'
import { isSenderBlocked, listBlocks } from './blocks'
import { getConversation, listConversations, setConversationStatus } from './conversations'
import { staffSend } from './conversations-send'
import { hashChatToken, inboxHash, newChatToken } from './identity'
import { messagesAfter } from './messages'
import type { ShopperIdentity } from './rules'
import { DEFAULT_INBOX_SETTINGS } from './settings'
import { markShopperSeen, mergeGuestConversation, shopperSend, shopperThread } from './shopper'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-settings-secret-test-settings-secret'

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function newStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  return s?.id as string
}

const inStore = <T>(storeId: string, fn: (ctx: StoreContext) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

const guest = (): ShopperIdentity => ({
  customerId: null,
  visitorKeyHash: hashChatToken(newChatToken()),
})

let n = 0
const clientId = () => `client-${++n}-${Date.now()}`
const opts = { secret: SECRET, settings: DEFAULT_INBOX_SETTINGS, ip: '203.0.113.7' }

const say = (storeId: string, who: ShopperIdentity, body: string, extra = {}) =>
  inStore(storeId, (ctx) =>
    shopperSend(ctx, who, { body, clientId: clientId(), ...extra }, { ...opts, ...extra }),
  )

async function newCustomer(storeId: string, email: string) {
  const [c] = await owner.insert(customer).values({ storeId, email, name: 'Asha' }).returning()
  return c?.id as string
}

describe('who can read a conversation', () => {
  it('another store cannot see it, even by id', async () => {
    const a = await newStore('a')
    const b = await newStore('b')
    const who = guest()
    const { conversation } = await say(a, who, 'Is the blue kurta in stock?')
    const fromB = await inStore(b, (ctx) =>
      ctx.tx.select().from(inboxConversation).where(eq(inboxConversation.id, conversation.id)),
    )
    expect(fromB).toEqual([])
    await expect(
      inStore(b, (ctx) => getConversation(ctx, { id: conversation.id }, SECRET)),
    ).rejects.toThrow(/not found/)
    expect(await inStore(b, (ctx) => shopperThread(ctx, who))).toBeNull()
  })

  it('a guest cannot read another visitor’s thread', async () => {
    const s = await newStore('s')
    const asha = guest()
    const ravi = guest()
    const { conversation } = await say(s, asha, 'Hello')
    expect(await inStore(s, (ctx) => shopperThread(ctx, ravi))).toBeNull()
    expect(
      await inStore(s, (ctx) => shopperThread(ctx, ravi, { conversationId: conversation.id })),
    ).toBeNull()
    expect(await inStore(s, (ctx) => markShopperSeen(ctx, ravi, conversation.id))).toBe(false)
    const own = await inStore(s, (ctx) => shopperThread(ctx, asha))
    expect(own?.messages.map((m) => m.body)).toEqual(['Hello'])
  })

  it('never shows staff notes, or which staff member wrote, to the shopper', async () => {
    const s = await newStore('s')
    const who = guest()
    const { conversation } = await say(s, who, 'Size?')
    await inStore(s, (ctx) =>
      staffSend(ctx, { conversationId: conversation.id, kind: 'note', body: 'VIP, be nice' }, 'u1'),
    )
    await inStore(s, (ctx) =>
      staffSend(ctx, { conversationId: conversation.id, body: 'M fits most' }, 'u1'),
    )
    const thread = await inStore(s, (ctx) => shopperThread(ctx, who))
    expect(thread?.messages.map((m) => m.body)).toEqual(['Size?', 'M fits most'])
    expect(thread?.messages[1]).not.toHaveProperty('memberUserId')
    expect(thread?.conversation.unreadShopper).toBe(1)
  })
})

describe('sending', () => {
  it('a resend with the same client id is stored once', async () => {
    const s = await newStore('s')
    const who = guest()
    const id = clientId()
    const first = await inStore(s, (ctx) =>
      shopperSend(ctx, who, { body: 'Hi', clientId: id }, opts),
    )
    const again = await inStore(s, (ctx) =>
      shopperSend(ctx, who, { body: 'Hi', clientId: id }, opts),
    )
    expect(again.created).toBe(false)
    expect(again.message.id).toBe(first.message.id)
    expect(again.conversation.unreadStaff).toBe(1)
  })

  it('one open thread per browser; a closed one reopens on the next message', async () => {
    const s = await newStore('s')
    const who = guest()
    const first = await say(s, who, 'One')
    const second = await say(s, who, 'Two')
    expect(second.conversation.id).toBe(first.conversation.id)
    expect(second.started).toBe(false)
    await inStore(s, (ctx) =>
      setConversationStatus(
        ctx,
        { id: first.conversation.id, status: 'closed' },
        { userId: 'u1', secret: SECRET },
      ),
    )
    const third = await say(s, who, 'Three')
    expect(third.conversation).toMatchObject({ id: first.conversation.id, status: 'open' })
  })

  it('refuses when sign-in is required and the shopper is a guest', async () => {
    const s = await newStore('s')
    await expect(
      inStore(s, (ctx) =>
        shopperSend(
          ctx,
          guest(),
          { body: 'Hi', clientId: clientId() },
          {
            ...opts,
            settings: { requireSignIn: true },
          },
        ),
      ),
    ).rejects.toThrow(/Sign in/)
  })

  it('keeps contact details, phone encrypted with its blind index', async () => {
    const s = await newStore('s')
    const { conversation } = await say(s, guest(), 'Call me', {
      name: 'Asha',
      email: 'Asha@Example.com',
      phone: '+91 98765 43210',
    })
    expect(conversation.contactEmail).toBe('asha@example.com')
    expect(conversation.contactPhone).not.toContain('98765')
    expect(conversation.contactVerified).toBe(false)
    const detail = await inStore(s, (ctx) => getConversation(ctx, { id: conversation.id }, SECRET))
    expect(detail.conversation.contactPhone).toBe('+91 98765 43210')
    const found = await inStore(s, (ctx) =>
      listConversations(ctx, { search: '9876543210' }, { userId: 'u1', secret: SECRET }),
    )
    expect(found.rows.map((r) => r.id)).toEqual([conversation.id])
  })
})

describe('realtime replay', () => {
  it('returns only what came after the last id, in order, without notes for the shopper', async () => {
    const s = await newStore('s')
    const who = guest()
    const first = await say(s, who, 'one')
    await say(s, who, 'two')
    await inStore(s, (ctx) =>
      staffSend(ctx, { conversationId: first.conversation.id, kind: 'note', body: 'note' }, 'u1'),
    )
    await inStore(s, (ctx) =>
      staffSend(ctx, { conversationId: first.conversation.id, body: 'three' }, 'u1'),
    )
    const shopper = await inStore(s, (ctx) =>
      messagesAfter(ctx.tx, first.conversation.id, first.message.id, { includeNotes: false }),
    )
    expect(shopper.map((m) => m.body)).toEqual(['two', 'three'])
    const staff = await inStore(s, (ctx) =>
      messagesAfter(ctx.tx, first.conversation.id, first.message.id, { includeNotes: true }),
    )
    expect(staff.map((m) => m.body)).toEqual(['two', 'note', 'three'])
    const replay = await inStore(s, (ctx) =>
      shopperThread(ctx, who, { afterId: shopper[0]?.id ?? null }),
    )
    expect(replay?.messages.map((m) => m.body)).toEqual(['three'])
  })
})

describe('signing in', () => {
  it('a guest thread joins the customer and the cookie alone no longer opens it', async () => {
    const s = await newStore('s')
    const who = guest()
    const { conversation } = await say(s, who, 'Hi')
    const customerId = await newCustomer(s, 'asha@example.com')
    const result = await inStore(s, (ctx) =>
      mergeGuestConversation(ctx, { visitorKeyHash: who.visitorKeyHash as string, customerId }),
    )
    expect(result).toEqual({ merged: 1, movedInto: null })
    const [row] = await owner
      .select()
      .from(inboxConversation)
      .where(eq(inboxConversation.id, conversation.id))
    expect(row).toMatchObject({
      customerId,
      contactVerified: true,
      contactEmail: 'asha@example.com',
    })
    expect(await inStore(s, (ctx) => shopperThread(ctx, who))).toBeNull()
    const signedIn = await inStore(s, (ctx) =>
      shopperThread(ctx, { customerId, visitorKeyHash: who.visitorKeyHash }),
    )
    expect(signedIn?.conversation.id).toBe(conversation.id)
  })

  it('moves guest messages into the customer’s open thread', async () => {
    const s = await newStore('s')
    const customerId = await newCustomer(s, 'asha@example.com')
    const signedIn = { customerId, visitorKeyHash: null }
    const older = await say(s, signedIn, 'From my account')
    const who = guest()
    const guestThread = await say(s, who, 'As a guest')
    const result = await inStore(s, (ctx) =>
      mergeGuestConversation(ctx, { visitorKeyHash: who.visitorKeyHash as string, customerId }),
    )
    expect(result.movedInto).toBe(older.conversation.id)
    const gone = await owner
      .select()
      .from(inboxConversation)
      .where(eq(inboxConversation.id, guestThread.conversation.id))
    expect(gone).toEqual([])
    const thread = await inStore(s, (ctx) => shopperThread(ctx, signedIn))
    expect(thread?.messages.map((m) => [m.kind, m.body])).toEqual([
      ['text', 'From my account'],
      ['text', 'As a guest'],
      ['system', ''],
    ])
    const [row] = await owner
      .select()
      .from(inboxConversation)
      .where(eq(inboxConversation.id, older.conversation.id))
    expect(row?.unreadStaff).toBe(2)
  })
})

describe('spam, blocks and limits', () => {
  it('a first message with more than two links lands in Blocked', async () => {
    const s = await newStore('s')
    const r = await say(s, guest(), 'cheap https://a.co https://b.co https://c.co')
    expect(r.spam).toBe(true)
    expect(r.conversation).toMatchObject({ status: 'blocked', blockedReason: 'spam' })
  })

  it('the third same first message from one IP is spam', async () => {
    const s = await newStore('s')
    expect((await say(s, guest(), 'Buy followers now')).spam).toBe(false)
    expect((await say(s, guest(), 'buy  followers NOW')).spam).toBe(false)
    expect((await say(s, guest(), 'Buy followers now')).spam).toBe(true)
    expect((await say(s, guest(), 'Buy followers now', { ip: '198.51.100.1' })).spam).toBe(false)
  })

  it('blocking a thread blocks the browser and the email; unblocking lifts both', async () => {
    const s = await newStore('s')
    const who = guest()
    const { conversation } = await say(s, who, 'Hi', { email: 'spam@x.co' })
    await inStore(s, (ctx) =>
      setConversationStatus(
        ctx,
        { id: conversation.id, status: 'blocked' },
        { userId: 'u1', secret: SECRET },
      ),
    )
    await expect(say(s, who, 'again')).rejects.toThrow(/closed/)
    await expect(say(s, guest(), 'new browser', { email: 'SPAM@x.co' })).rejects.toThrow(/closed/)
    expect(await inStore(s, (ctx) => listBlocks(ctx))).toHaveLength(2)
    await inStore(s, (ctx) =>
      setConversationStatus(
        ctx,
        { id: conversation.id, status: 'open' },
        { userId: 'u1', secret: SECRET },
      ),
    )
    expect(await inStore(s, (ctx) => listBlocks(ctx))).toHaveLength(0)
    expect((await say(s, who, 'back')).conversation.id).toBe(conversation.id)
  })

  it('IP blocks expire after 30 days', async () => {
    const s = await newStore('s')
    const ipHash = inboxHash('ip', '203.0.113.9', SECRET)
    const { blockSender } = await import('./blocks')
    const now = new Date('2026-10-24T00:00:00Z')
    await inStore(s, (ctx) =>
      blockSender(ctx, { kind: 'ip', valueHash: ipHash, reason: 'staff' }, now),
    )
    expect(await inStore(s, (ctx) => isSenderBlocked(ctx.tx, { ipHash }, now))).toBe(true)
    const later = new Date('2026-11-24T00:00:00Z')
    expect(await inStore(s, (ctx) => isSenderBlocked(ctx.tx, { ipHash }, later))).toBe(false)
  })

  it('rate limits per conversation, per store', async () => {
    const s = await newStore('s')
    const limiter = createMemoryRateLimitStore()
    const who = guest()
    const now = new Date('2026-10-24T10:00:00Z')
    const send = (body: string) =>
      inStore(s, (ctx) =>
        shopperSend(ctx, who, { body, clientId: clientId() }, { ...opts, limiter, now }),
      )
    await send('first')
    for (let i = 0; i < 10; i++) await send(`m${i}`)
    await expect(send('one too many')).rejects.toThrow(/Too many/)
  })
})
