/** SOURCE OF TRUTH: Inbox AI agent tests — WHAT: when the agent answers, hands off or stays quiet (mode, staff take-over, a newer message, asking for a person, low confidence), what it posts (text plus product cards it was shown) and what it logs / WHY: the agent speaks to shoppers in the store's name, so it must stop the moment a person takes over and never show a product it was not given (design §13). */
import { textModel } from '@commerce/ai/testing'
import {
  createDb,
  inboxAiEvent,
  inboxConversation,
  inboxMessage,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import { runInboxAiReply } from './ai-agent'
import { asksForHuman } from './ai-rules'
import { staffSend } from './conversations'
import { hashChatToken, newChatToken } from './identity'
import type { ShopperIdentity } from './rules'
import { DEFAULT_INBOX_SETTINGS, type InboxAiMode } from './settings'
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

let n = 0

async function newStore(mode: InboxAiMode) {
  const settings = { ...DEFAULT_INBOX_SETTINGS, ai: { mode, knowledge: 'We ship in 3 days.' } }
  const [s] = await owner
    .insert(store)
    .values({
      slug: `ai-${mode}-${++n}`,
      name: 'Kurta House',
      apps: { installed: ['inbox'], settings: { inbox: settings } },
    })
    .returning()
  return s?.id as string
}

async function newProduct(storeId: string, title: string) {
  const [p] = await owner
    .insert(product)
    .values({ storeId, title, handle: title.toLowerCase().replace(/\s+/g, '-'), status: 'active' })
    .returning()
  await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: 'M', pricePaise: 129_900 })
  return p?.id as string
}

const inStore = <T>(storeId: string, fn: (ctx: StoreContext) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

const guest = (): ShopperIdentity => ({
  customerId: null,
  visitorKeyHash: hashChatToken(newChatToken()),
})

const say = (storeId: string, who: ShopperIdentity, body: string) =>
  inStore(storeId, (ctx) =>
    shopperSend(
      ctx,
      who,
      { body, clientId: `client-${++n}-${Date.now()}` },
      { secret: SECRET, settings: DEFAULT_INBOX_SETTINGS, ip: '203.0.113.7' },
    ),
  )

const answer = (over: Record<string, unknown> = {}) =>
  textModel(
    JSON.stringify({
      action: 'reply',
      reply: 'Yes, the blue kurta is in stock at ₹1,299.',
      productIds: [],
      handoffReason: null,
      summary: '',
      confidence: 90,
      ...over,
    }),
  )

const run = (storeId: string, conversationId: string, messageId: string, model = answer()) =>
  runInboxAiReply({ db: app, job: { storeId, conversationId, messageId }, model })

const thread = (conversationId: string) =>
  owner
    .select()
    .from(inboxMessage)
    .where(eq(inboxMessage.conversationId, conversationId))
    .orderBy(asc(inboxMessage.id))

const conversationRow = async (id: string) => {
  const [c] = await owner.select().from(inboxConversation).where(eq(inboxConversation.id, id))
  return c
}

describe('asksForHuman', () => {
  it('catches English, Hinglish and Hindi asks for a person', () => {
    expect(asksForHuman('can I talk to a human please')).toBe(true)
    expect(asksForHuman('kisi insaan se baat karni hai')).toBe(true)
    expect(asksForHuman('किसी से बात कराओ')).toBe(true)
    expect(asksForHuman('is the blue kurta in stock?')).toBe(false)
  })
})

describe('runInboxAiReply', () => {
  it('answers with the products it was shown, and only those', async () => {
    const s = await newStore('all')
    const kurta = await newProduct(s, 'Blue Kurta')
    const { conversation, message } = await say(s, guest(), 'Is the blue kurta in stock?')
    const result = await run(
      s,
      conversation.id,
      message.id,
      answer({ productIds: [kurta, '00000000-0000-7000-8000-000000000000'] }),
    )
    expect(result.done).toBe('answered')
    const ai = (await thread(conversation.id)).filter((m) => m.sender === 'ai')
    expect(ai.map((m) => m.kind)).toEqual(['text', 'product'])
    expect(ai[1]?.payload).toEqual({ productIds: [kurta] })
    const c = await conversationRow(conversation.id)
    expect(c?.unreadShopper).toBe(2)
    expect(c?.needsHuman).toBe(false)
    const events = await owner.select().from(inboxAiEvent).where(eq(inboxAiEvent.storeId, s))
    expect(events.map((e) => e.kind)).toEqual(['answer'])
  })

  it('hands off without a model call when the shopper asks for a person', async () => {
    const s = await newStore('all')
    const { conversation, message } = await say(s, guest(), 'I want to talk to a human')
    const result = await run(s, conversation.id, message.id, textModel('not json'))
    expect(result).toMatchObject({ done: 'handed_off', reason: 'asked_for_human' })
    const c = await conversationRow(conversation.id)
    expect(c?.needsHuman).toBe(true)
    expect(c?.handoffSummary).toBeTruthy()
  })

  it('hands off when the model is unsure or fails', async () => {
    const s = await newStore('all')
    const first = await say(s, guest(), 'Where is my refund?')
    const unsure = await run(s, first.conversation.id, first.message.id, answer({ confidence: 30 }))
    expect(unsure.done).toBe('handed_off')

    const s2 = await newStore('all')
    const second = await say(s2, guest(), 'Do you ship to Pune?')
    const failed = await run(s2, second.conversation.id, second.message.id, textModel('oops'))
    expect(failed).toMatchObject({ done: 'handed_off', reason: 'not_confident' })
  })

  it('stays quiet once handed off, after staff reply, or when the mode is off', async () => {
    const s = await newStore('all')
    const who = guest()
    const asked = await say(s, who, 'talk to a person please')
    await run(s, asked.conversation.id, asked.message.id)
    const again = await say(s, who, 'hello?')
    expect(await run(s, again.conversation.id, again.message.id)).toMatchObject({
      done: 'skipped',
      why: 'not_allowed',
    })

    const s2 = await newStore('all')
    const who2 = guest()
    const q = await say(s2, who2, 'Size chart?')
    await inStore(s2, (ctx) =>
      staffSend(ctx, { conversationId: q.conversation.id, body: 'Hi!' }, 'u1'),
    )
    const next = await say(s2, who2, 'thanks, and colours?')
    expect((await run(s2, next.conversation.id, next.message.id)).done).toBe('skipped')

    const s3 = await newStore('off')
    const off = await say(s3, guest(), 'Is the blue kurta in stock?')
    expect((await run(s3, off.conversation.id, off.message.id)).done).toBe('skipped')
    expect(await thread(off.conversation.id)).toHaveLength(1)
  })

  it('skips a message that is no longer the newest', async () => {
    const s = await newStore('all')
    const who = guest()
    const first = await say(s, who, 'Hi')
    await say(s, who, 'Is the blue kurta in stock?')
    expect(await run(s, first.conversation.id, first.message.id)).toMatchObject({
      done: 'skipped',
      why: 'superseded',
    })
  })
})
