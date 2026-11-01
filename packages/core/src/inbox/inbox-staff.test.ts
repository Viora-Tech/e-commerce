/** SOURCE OF TRUTH: Inbox staff service tests — WHAT: views, counts, assignment, status, replies and cards, search, cart events, quick replies and settings / WHY: the admin inbox must agree with the widget and refuse what cannot be shared */
import {
  createDb,
  customer,
  discount,
  inboxConversation,
  inboxMessage,
  media,
  product,
  store,
  storeMember,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import {
  assignConversation,
  inboxCounts,
  listConversations,
  markStaffSeen,
  setConversationStatus,
} from './conversations'
import { staffSend } from './conversations-send'
import { hashChatToken, newChatToken } from './identity'
import { createQuickReply, listQuickReplies, updateQuickReply } from './quick-replies'
import type { ShopperIdentity } from './rules'
import { DEFAULT_INBOX_SETTINGS } from './settings'
import { findShopperConversation, postCartEvent, shopperSend } from './shopper'
import { inboxState, saveInboxSettings } from './state'

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

async function _newCustomer(storeId: string, email: string) {
  const [c] = await owner.insert(customer).values({ storeId, email, name: 'Asha' }).returning()
  return c?.id as string
}

describe('staff', () => {
  it('views, counts, unread, assignment and close', async () => {
    const s = await newStore('s')
    await owner.insert(storeMember).values({
      storeId: s,
      userId: 'u2',
      roleId: (
        await owner.execute<{ id: string }>(
          sql`insert into role (id, store_id, slug, name, is_system) values (gen_random_uuid(), ${s}, 'staff', 'Staff', true) returning id`,
        )
      )[0]?.id as string,
    })
    const a = await say(s, guest(), 'A')
    const b = await say(s, guest(), 'B')
    let counts = await inStore(s, (ctx) => inboxCounts(ctx, 'u2'))
    expect(counts).toMatchObject({ open: 2, unassigned: 2, mine: 0, unread: 2 })

    await inStore(s, (ctx) =>
      assignConversation(ctx, { id: a.conversation.id, assigneeUserId: 'u2' }, 'u1'),
    )
    await expect(
      inStore(s, (ctx) =>
        assignConversation(ctx, { id: a.conversation.id, assigneeUserId: 'nobody' }, 'u1'),
      ),
    ).rejects.toThrow(/not on this store/)
    await inStore(s, (ctx) => markStaffSeen(ctx, b.conversation.id))
    await inStore(s, (ctx) =>
      setConversationStatus(
        ctx,
        { id: b.conversation.id, status: 'closed' },
        { userId: 'u1', secret: SECRET },
      ),
    )
    counts = await inStore(s, (ctx) => inboxCounts(ctx, 'u2'))
    expect(counts).toMatchObject({ open: 1, mine: 1, unassigned: 0, closed: 1, all: 2, unread: 1 })
    const mine = await inStore(s, (ctx) =>
      listConversations(ctx, { view: 'mine' }, { userId: 'u2', secret: SECRET }),
    )
    expect(mine.rows.map((r) => r.id)).toEqual([a.conversation.id])
    const closed = await inStore(s, (ctx) =>
      listConversations(ctx, { view: 'closed' }, { userId: 'u2', secret: SECRET }),
    )
    expect(closed.rows[0]).toMatchObject({ id: b.conversation.id, unreadStaff: 0 })
    const all = await inStore(s, (ctx) =>
      listConversations(ctx, { view: 'all' }, { userId: 'u2', secret: SECRET }),
    )
    expect(all.rows.map((r) => r.id).sort()).toEqual([a.conversation.id, b.conversation.id].sort())
  })

  it('a reply marks first response, clears unread, and reopens a closed thread', async () => {
    const s = await newStore('s')
    const { conversation } = await say(s, guest(), 'Hello?')
    await inStore(s, (ctx) =>
      setConversationStatus(
        ctx,
        { id: conversation.id, status: 'closed' },
        { userId: 'u1', secret: SECRET },
      ),
    )
    const r = await inStore(s, (ctx) =>
      staffSend(ctx, { conversationId: conversation.id, body: 'Hi!' }, 'u1'),
    )
    expect(r.conversation).toMatchObject({
      status: 'open',
      unreadStaff: 0,
      unreadShopper: 1,
      lastSender: 'staff',
    })
    expect(r.conversation.firstResponseAt).not.toBeNull()
  })

  it('shares active products and codes only', async () => {
    const s = await newStore('s')
    const { conversation } = await say(s, guest(), 'Any offers?')
    const [p] = await owner
      .insert(product)
      .values({ storeId: s, title: 'Kurta', handle: 'kurta', status: 'active' })
      .returning()
    const [draft] = await owner
      .insert(product)
      .values({ storeId: s, title: 'Draft', handle: 'draft', status: 'draft' })
      .returning()
    const [live] = await owner
      .insert(discount)
      .values({ storeId: s, title: 'Ten', code: 'TEN', method: 'percent', value: 10 })
      .returning()
    const [off] = await owner
      .insert(discount)
      .values({
        storeId: s,
        title: 'Old',
        code: 'OLD',
        method: 'percent',
        value: 10,
        status: 'disabled',
      })
      .returning()
    const [img] = await owner
      .insert(media)
      .values({ storeId: s, url: 'https://cdn.example/a.jpg' })
      .returning()
    const send = (input: Record<string, unknown>) =>
      inStore(s, (ctx) => staffSend(ctx, { conversationId: conversation.id, ...input }, 'u1'))

    const card = await send({ kind: 'product', productIds: [p?.id] })
    expect(card.message.payload).toEqual({ productIds: [p?.id] })
    await expect(send({ kind: 'product', productIds: [draft?.id] })).rejects.toThrow(
      /active products/,
    )
    const code = await send({ kind: 'discount', discountId: live?.id })
    expect(code.message.payload).toEqual({ discountId: live?.id, code: 'TEN' })
    await expect(send({ kind: 'discount', discountId: off?.id })).rejects.toThrow(/active discount/)
    const image = await send({ kind: 'image', mediaId: img?.id })
    expect(image.message.payload).toMatchObject({ mediaId: img?.id })
    await expect(send({ body: '   ' })).rejects.toThrow(/Write a message/)
    expect(image.conversation.lastMessagePreview).toBe('[Image]')
  })

  it('search finds a word from the thread', async () => {
    const s = await newStore('s')
    const a = await say(s, guest(), 'Do you ship to Pune?')
    await say(s, guest(), 'COD available?')
    const found = await inStore(s, (ctx) =>
      listConversations(ctx, { search: 'pune' }, { userId: 'u1', secret: SECRET }),
    )
    expect(found.rows.map((r) => r.id)).toEqual([a.conversation.id])
  })

  it('cart changes post into an open thread only', async () => {
    const s = await newStore('s')
    const who = guest()
    const event = { action: 'add' as const, variantId: 'v', title: 'Kurta', quantity: 1 }
    expect(await inStore(s, (ctx) => postCartEvent(ctx, who, event))).toBeNull()
    const { conversation } = await say(s, who, 'Hi')
    const line = await inStore(s, (ctx) => postCartEvent(ctx, who, event))
    expect(line).toMatchObject({
      kind: 'cart_event',
      sender: 'system',
      conversationId: conversation.id,
    })
    const [row] = await owner
      .select()
      .from(inboxConversation)
      .where(eq(inboxConversation.id, conversation.id))
    expect(row?.lastMessagePreview).toBe('Hi')
  })
})

describe('quick replies and settings', () => {
  it('shortcuts are unique per store', async () => {
    const s = await newStore('s')
    const other = await newStore('o')
    const r = await inStore(s, (ctx) =>
      createQuickReply(ctx, { title: 'Sizes', body: 'S to XL', shortcut: '/Size' }),
    )
    expect(r.shortcut).toBe('size')
    await expect(
      inStore(s, (ctx) => createQuickReply(ctx, { title: 'Again', body: 'x', shortcut: 'size' })),
    ).rejects.toThrow(/already used/)
    await inStore(other, (ctx) =>
      createQuickReply(ctx, { title: 'Sizes', body: 'x', shortcut: 'size' }),
    )
    await inStore(s, (ctx) =>
      updateQuickReply(ctx, { id: r.id, title: 'Sizes', body: 'XS to XXL', shortcut: 'size' }),
    )
    expect((await inStore(s, listQuickReplies)).map((q) => q.body)).toEqual(['XS to XXL'])
  })

  it('settings live in store.apps and keep other apps alone', async () => {
    const s = await newStore('s')
    await owner
      .update(store)
      .set({ apps: { installed: ['inbox', 'reviews'], settings: { reviews: { x: 1 } } } })
      .where(eq(store.id, s))
    await inStore(s, (ctx) =>
      saveInboxSettings(ctx.tx, s, { greeting: 'Namaste', availability: 'hours' }),
    )
    const state = await inStore(s, (ctx) => inboxState(ctx.tx, s))
    expect(state).toMatchObject({ installed: true, timeZone: 'Asia/Kolkata' })
    expect(state.settings).toMatchObject({
      greeting: 'Namaste',
      availability: 'hours',
      requireSignIn: false,
    })
    const [row] = await owner.select({ apps: store.apps }).from(store).where(eq(store.id, s))
    expect(row?.apps).toMatchObject({
      installed: ['inbox', 'reviews'],
      settings: { reviews: { x: 1 } },
    })
  })

  it('finds nothing for a shopper with no identity', async () => {
    const s = await newStore('s')
    expect(
      await inStore(s, (ctx) =>
        findShopperConversation(ctx.tx, { customerId: null, visitorKeyHash: null }),
      ),
    ).toBeNull()
    const rows = await owner.select().from(inboxMessage)
    expect(rows).toEqual([])
  })
})
