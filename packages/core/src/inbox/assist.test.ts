/** SOURCE OF TRUTH: Inbox staff AI help tests — WHAT: what the suggested replies and the summary read about a chat (the product page the shopper is on, the products the question names, team notes, orders with shipments only for a signed-in shopper and a member who may read orders, whether a reply is due) and what the customer panel shows of the shopper's activity (pages, product, location, phone) / WHY: an unverified email or a member without orders access must never put a shopper's orders in front of the AI. */
import { createDb, customer, product, store, variant, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import { inboxAssistContext } from './assist'
import { staffSend } from './conversations'
import { hashChatToken, newChatToken } from './identity'
import { customerPanel } from './panel'
import type { ShopperIdentity } from './rules'
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
  const [s] = await owner
    .insert(store)
    .values({
      slug: `assist-${++n}`,
      name: 'Kurta House',
      apps: {
        installed: ['inbox'],
        settings: {
          inbox: { ...DEFAULT_INBOX_SETTINGS, ai: { mode: 'off', knowledge: 'We pack in 1 day.' } },
        },
      },
    })
    .returning()
  const storeId = s?.id as string
  const [p] = await owner
    .insert(product)
    .values({ storeId, title: 'Blue Kurta', handle: 'blue-kurta', status: 'active' })
    .returning()
  await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: 'M', pricePaise: 129_900 })
  const say = (who: ShopperIdentity, body: string, url?: string) =>
    inStore(storeId, (ctx) =>
      shopperSend(
        ctx,
        who,
        { body, clientId: `client-${++n}-${Date.now()}`, ...(url ? { url } : {}) },
        { secret: SECRET, settings: DEFAULT_INBOX_SETTINGS, ip: '203.0.113.9' },
      ),
    )
  return { storeId, productId: p?.id as string, say }
}

async function signedIn(storeId: string) {
  const [c] = await owner
    .insert(customer)
    .values({
      storeId,
      email: 'asha@x.co',
      name: 'Asha',
      phone: '9876543210',
      defaultAddress: {
        name: 'Asha',
        line1: '1 MG Road',
        city: 'Pune',
        stateCode: 'MH',
        pincode: '411001',
      },
    })
    .returning()
  const customerId = c?.id as string
  const [o] = await owner.execute<{ id: string }>(sql`
    insert into "order" (id, store_id, number, customer_id, subtotal_paise, total_paise, status)
    values (gen_random_uuid(), ${storeId}, 1042, ${customerId}, 129900, 129900, 'open') returning id`)
  await owner.execute(sql`
    insert into shipment (id, store_id, order_id, provider, waybill, status)
    values (gen_random_uuid(), ${storeId}, ${o?.id}, 'delhivery', 'AWB123', 'in_transit')`)
  return customerId
}

describe('inboxAssistContext', () => {
  it('reads the product page, the question’s products and the store notes; a reply is due', async () => {
    const { storeId, productId, say } = await setup()
    const guest = { customerId: null, visitorKeyHash: hashChatToken(newChatToken()) }
    const { conversation } = await say(
      guest,
      'Is this kurta in size M?',
      '/products/blue-kurta?x=1',
    )
    const ctx = await inStore(storeId, (c) =>
      inboxAssistContext(c, conversation.id, { ordersAllowed: true }),
    )
    expect(ctx.installed).toBe(true)
    expect(ctx.storeName).toBe('Kurta House')
    expect(ctx.awaitsReply).toBe(true)
    expect(ctx.input.viewing).toMatchObject({ id: productId, pricePaise: 129_900 })
    expect(ctx.input.products.map((p) => p.id)).toEqual([productId])
    expect(ctx.input.knowledge).toBe('We pack in 1 day.')
    // A guest's orders are never read, even with orders access.
    expect(ctx.input.orders).toBeNull()
  })

  it('a staff reply means no reply is due; team notes reach the AI marked as notes', async () => {
    const { storeId, say } = await setup()
    const guest = { customerId: null, visitorKeyHash: hashChatToken(newChatToken()) }
    const { conversation } = await say(guest, 'Hello')
    await inStore(storeId, (ctx) =>
      staffSend(
        ctx,
        { conversationId: conversation.id, kind: 'text', body: 'Hi! How can we help?' },
        'user-1',
      ),
    )
    await inStore(storeId, (ctx) =>
      staffSend(
        ctx,
        { conversationId: conversation.id, kind: 'note', body: 'VIP shopper' },
        'user-1',
      ),
    )
    const ctx = await inStore(storeId, (c) =>
      inboxAssistContext(c, conversation.id, { ordersAllowed: true }),
    )
    expect(ctx.awaitsReply).toBe(false)
    expect(ctx.input.thread.map((m) => m.from)).toEqual(['shopper', 'store', 'note'])
    expect(ctx.messageCount).toBe(2)
  })

  it('a signed-in shopper’s orders and shipments only with orders access', async () => {
    const { storeId, say } = await setup()
    const customerId = await signedIn(storeId)
    const { conversation } = await say({ customerId, visitorKeyHash: null }, 'Where is my order?')
    const full = await inStore(storeId, (c) =>
      inboxAssistContext(c, conversation.id, { ordersAllowed: true }),
    )
    expect(full.input.orders).toEqual([
      expect.objectContaining({
        name: '#1042',
        status: 'open',
        shipments: [{ courier: 'delhivery', waybill: 'AWB123', status: 'in_transit' }],
      }),
    ])
    const limited = await inStore(storeId, (c) =>
      inboxAssistContext(c, conversation.id, { ordersAllowed: false }),
    )
    expect(limited.input.orders).toBeNull()
  })
})

describe('customer panel activity', () => {
  it('lists the pages the shopper wrote from, the product they are on, phone and location', async () => {
    const { storeId, productId, say } = await setup()
    const customerId = await signedIn(storeId)
    const who = { customerId, visitorKeyHash: null }
    const { conversation } = await say(who, 'Hi', '/collections/kurtas')
    await say(who, 'Is this one cotton?', '/products/blue-kurta')
    const panel = await inStore(storeId, (ctx) =>
      customerPanel(ctx, conversation.id, { ordersAllowed: true, secret: SECRET }),
    )
    expect(panel.pages).toEqual(['/products/blue-kurta', '/collections/kurtas'])
    expect(panel.viewing?.id).toBe(productId)
    expect(panel.phone).toBe('9876543210')
    expect(panel.location).toEqual({ city: 'Pune', stateCode: 'MH', pincode: '411001' })
    expect(panel.orders[0]).toMatchObject({ number: 1042, paymentStatus: 'unpaid' })
  })
})
