/** SOURCE OF TRUTH: Inbox events and polling tests — WHAT: which channel each event goes to (notes and staff ids never on a shopper's channel), the stream replays, and `inboxSync` (the admin's polling fallback) catching up from a message id / WHY: stream, replay and poll must hand a client the same messages */
import { createDb, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import { staffSend } from './conversations-send'
import {
  inboxSync,
  messageEvents,
  seenEvents,
  shopperReplay,
  storeReplay,
  typingEvent,
} from './events'
import { hashChatToken, newChatToken } from './identity'
import { replayFloorId } from './realtime'
import { DEFAULT_INBOX_SETTINGS } from './settings'
import { shopperSend } from './shopper'

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

const inStore = <T>(storeId: string, fn: (ctx: StoreContext) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

let n = 0
async function setup() {
  const [s] = await owner.insert(store).values({ slug: 's', name: 's' }).returning()
  const storeId = s?.id as string
  const who = { customerId: null, visitorKeyHash: hashChatToken(newChatToken()) }
  const say = (body: string) =>
    inStore(storeId, (ctx) =>
      shopperSend(
        ctx,
        who,
        { body, clientId: `client-${++n}-x` },
        {
          secret: SECRET,
          settings: DEFAULT_INBOX_SETTINGS,
          ip: '203.0.113.1',
        },
      ),
    )
  return { storeId, say }
}

describe('event channels', () => {
  it('a note goes to staff only; a reply reaches the shopper without the staff id', async () => {
    const { storeId, say } = await setup()
    const first = await say('Hi')
    const note = await inStore(storeId, (ctx) =>
      staffSend(ctx, { conversationId: first.conversation.id, kind: 'note', body: 'psst' }, 'u1'),
    )
    const reply = await inStore(storeId, (ctx) =>
      staffSend(ctx, { conversationId: first.conversation.id, body: 'Hello!' }, 'u1'),
    )
    const noteEvents = messageEvents(storeId, note.conversation, note.message)
    expect(noteEvents.map((e) => e.channel)).toEqual([`inbox:${storeId}`, `inbox:${storeId}`])
    const replyEvents = messageEvents(storeId, reply.conversation, reply.message)
    const toShopper = replyEvents.find((e) => e.channel === `conv:${first.conversation.id}`)
    expect(toShopper?.event).toMatchObject({ type: 'message', message: { body: 'Hello!' } })
    expect(JSON.stringify(toShopper?.event)).not.toContain('u1')
    expect(JSON.stringify(replyEvents[0]?.event)).toContain('u1')
  })

  it('typing and seen go to the other side', () => {
    expect(typingEvent('s', 'c', 'staff').channel).toBe('conv:c')
    expect(typingEvent('s', 'c', 'shopper').channel).toBe('inbox:s')
    expect(seenEvents('s', 'c', 'staff', 'm').map((e) => e.channel)).toEqual(['conv:c', 'inbox:s'])
    expect(seenEvents('s', 'c', 'shopper', 'm').map((e) => e.channel)).toEqual(['inbox:s'])
  })

  it('a spam thread sends nothing to the shopper channel', async () => {
    const { say, storeId } = await setup()
    const spam = await say('x https://a.co https://b.co https://c.co')
    const events = messageEvents(storeId, spam.conversation, spam.message)
    expect(events.some((e) => e.channel.startsWith('conv:'))).toBe(false)
  })
})

describe('replays and polling', () => {
  it('the replays start a little before the last id; the shopper replay skips notes', async () => {
    const { storeId, say } = await setup()
    const first = await say('one')
    await inStore(storeId, (ctx) =>
      staffSend(ctx, { conversationId: first.conversation.id, kind: 'note', body: 'note' }, 'u1'),
    )
    await say('two')
    const floor = replayFloorId(first.message.id)
    const staff = await inStore(storeId, (ctx) => storeReplay(ctx.tx, floor))
    expect(staff.map((e) => e.type === 'message' && e.message.body)).toEqual(['one', 'note', 'two'])
    const shopper = await inStore(storeId, (ctx) =>
      shopperReplay(ctx.tx, first.conversation.id, floor),
    )
    expect(shopper.map((e) => e.type === 'message' && e.message.body)).toEqual(['one', 'two'])
    expect(await inStore(storeId, (ctx) => storeReplay(ctx.tx, null))).toEqual([])
  })

  it('inbox.sync starts with a cursor, then returns what came after it', async () => {
    const { storeId, say } = await setup()
    const start = await inStore(storeId, (ctx) => inboxSync(ctx, {}, 'u1'))
    expect(start).toMatchObject({ cursor: null, messages: [], conversations: [] })
    const first = await say('one')
    const next = await inStore(storeId, (ctx) => inboxSync(ctx, {}, 'u1'))
    expect(next.cursor).toBe(first.message.id)
    const second = await say('two')
    const polled = await inStore(storeId, (ctx) => inboxSync(ctx, { since: next.cursor }, 'u1'))
    // Starts 5 s early, so `one` comes again; the client drops it by id.
    expect(polled.messages.map((m) => m.body)).toEqual(['one', 'two'])
    expect(polled.cursor).toBe(second.message.id)
    expect(polled.conversations.map((c) => c.id)).toEqual([first.conversation.id])
    expect(polled.counts).toMatchObject({ open: 1, unread: 1 })
  })
})
