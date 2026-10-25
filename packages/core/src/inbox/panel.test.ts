/** SOURCE OF TRUTH: Inbox panel tests — WHAT: the customer panel (a verified customer's orders only with orders access; a typed email is a possible match with no orders), the live cart from a cart line, cards and featured products, assignees, the 30-day numbers, the Unread view / WHY: an unverified email must never show a shopper's orders */
import {
  createDb,
  customer,
  discount,
  product,
  role,
  rolePermission,
  store,
  storeMember,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import { inboxCounts, listConversations, staffSend } from './conversations'
import { hashChatToken, newChatToken } from './identity'
import {
  customerPanel,
  featuredProducts,
  inboxAssignees,
  inboxMetrics,
  messageCards,
} from './panel'
import { DEFAULT_INBOX_SETTINGS } from './settings'
import { postCartEvent, shopperSend } from './shopper'

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
    .values({ slug: `s${++n}`, name: 'Shop' })
    .returning()
  const storeId = s?.id as string
  const say = (
    who: { customerId: string | null; visitorKeyHash: string | null },
    body: string,
    extra = {},
  ) =>
    inStore(storeId, (ctx) =>
      shopperSend(
        ctx,
        who,
        { body, clientId: `client-${++n}-xyz`, ...extra },
        {
          secret: SECRET,
          settings: DEFAULT_INBOX_SETTINGS,
          ip: '203.0.113.5',
        },
      ),
    )
  return { storeId, say }
}

async function addOrder(storeId: string, customerId: string, number: number, totalPaise: number) {
  await owner.execute(sql`
    insert into "order" (id, store_id, number, customer_id, subtotal_paise, total_paise, status)
    values (gen_random_uuid(), ${storeId}, ${number}, ${customerId}, ${totalPaise}, ${totalPaise}, 'open')`)
}

describe('customer panel', () => {
  it('a signed-in customer shows orders only to members who may read them', async () => {
    const { storeId, say } = await setup()
    const [c] = await owner
      .insert(customer)
      .values({ storeId, email: 'asha@x.co', name: 'Asha' })
      .returning()
    await addOrder(storeId, c?.id as string, 1001, 50_000)
    const { conversation } = await say({ customerId: c?.id as string, visitorKeyHash: null }, 'Hi')
    const full = await inStore(storeId, (ctx) =>
      customerPanel(ctx, conversation.id, { ordersAllowed: true }),
    )
    expect(full.customer).toMatchObject({ name: 'Asha', orderCount: 1, totalSpentPaise: 50_000 })
    expect(full.orders.map((o) => o.number)).toEqual([1001])
    expect(full.returning).toBe(true)
    const limited = await inStore(storeId, (ctx) =>
      customerPanel(ctx, conversation.id, { ordersAllowed: false }),
    )
    expect(limited.orders).toEqual([])
  })

  it('a typed email is a possible match: no customer, no orders', async () => {
    const { storeId, say } = await setup()
    const [c] = await owner
      .insert(customer)
      .values({ storeId, email: 'asha@x.co', name: 'Asha' })
      .returning()
    await addOrder(storeId, c?.id as string, 1002, 10_000)
    const guest = { customerId: null, visitorKeyHash: hashChatToken(newChatToken()) }
    const { conversation } = await say(guest, 'Where is my order?', { email: 'Asha@x.co' })
    const panel = await inStore(storeId, (ctx) =>
      customerPanel(ctx, conversation.id, { ordersAllowed: true }),
    )
    expect(panel.customer).toBeNull()
    expect(panel.possibleMatch).toMatchObject({ id: c?.id, name: 'Asha' })
    expect(panel.orders).toEqual([])
    expect(panel.returning).toBe(false)
  })

  it('shows a guest’s live cart from the cart line in the thread', async () => {
    const { storeId, say } = await setup()
    const [p] = await owner
      .insert(product)
      .values({ storeId, title: 'Kurta', handle: 'kurta', status: 'active' })
      .returning()
    const [v] = await owner
      .insert(variant)
      .values({
        storeId,
        productId: p?.id as string,
        title: 'Default',
        pricePaise: 120_000,
        trackInventory: false,
      })
      .returning()
    const [cart] = await owner.execute<{ id: string }>(
      sql`insert into cart (id, store_id) values (gen_random_uuid(), ${storeId}) returning id`,
    )
    await owner.execute(
      sql`insert into cart_line (id, store_id, cart_id, variant_id, quantity, unit_price_paise) values (gen_random_uuid(), ${storeId}, ${cart?.id}, ${v?.id}, 2, 120000)`,
    )
    const guest = { customerId: null, visitorKeyHash: hashChatToken(newChatToken()) }
    const { conversation } = await say(guest, 'Hi')
    await inStore(storeId, (ctx) =>
      postCartEvent(ctx, guest, {
        action: 'add',
        variantId: v?.id as string,
        title: 'Kurta',
        quantity: 2,
        cartId: cart?.id as string,
      }),
    )
    const panel = await inStore(storeId, (ctx) =>
      customerPanel(ctx, conversation.id, { ordersAllowed: true }),
    )
    expect(panel.cart).toMatchObject({ itemCount: 2, subtotalPaise: 240_000 })
  })
})

describe('cards, featured products, assignees, numbers', () => {
  it('cards carry a buyable variant; featured falls back to best sellers', async () => {
    const { storeId, say } = await setup()
    const [p] = await owner
      .insert(product)
      .values({ storeId, title: 'Saree', handle: 'saree', status: 'active' })
      .returning()
    await owner.insert(variant).values({
      storeId,
      productId: p?.id as string,
      title: 'Default',
      pricePaise: 99_000,
      trackInventory: false,
    })
    const [d] = await owner
      .insert(discount)
      .values({ storeId, title: 'Ten', code: 'TEN', method: 'percent', value: 10 })
      .returning()
    const guest = { customerId: null, visitorKeyHash: hashChatToken(newChatToken()) }
    const { conversation } = await say(guest, 'Offers?')
    const card = await inStore(storeId, (ctx) =>
      staffSend(
        ctx,
        { conversationId: conversation.id, kind: 'product', productIds: [p?.id as string] },
        'u1',
      ),
    )
    const code = await inStore(storeId, (ctx) =>
      staffSend(
        ctx,
        { conversationId: conversation.id, kind: 'discount', discountId: d?.id as string },
        'u1',
      ),
    )
    const cards = await inStore(storeId, (ctx) =>
      messageCards(ctx.tx, [card.message, code.message]),
    )
    expect(cards.products[p?.id as string]).toMatchObject({
      title: 'Saree',
      available: true,
      minPricePaise: 99_000,
    })
    expect(cards.products[p?.id as string]?.variantId).toBeTruthy()
    expect(cards.discounts[d?.id as string]).toMatchObject({ code: 'TEN', active: true })
    const featured = await inStore(storeId, (ctx) => featuredProducts(ctx.tx, []))
    expect(featured.map((f) => f.title)).toEqual(['Saree'])
  })

  it('assignees are owners and roles that may reply; numbers and the Unread view add up', async () => {
    const { storeId, say } = await setup()
    await owner.execute(sql`insert into "user" (id, name, email, email_verified, created_at, updated_at) values
      ('u-owner', 'Owner', 'o@x.co', true, now(), now()), ('u-helper', 'Helper', 'h@x.co', true, now(), now()), ('u-packer', 'Packer', 'p@x.co', true, now(), now())`)
    const roles = await owner
      .insert(role)
      .values([
        { storeId, slug: 'owner', name: 'Owner', isSystem: true },
        { storeId, slug: 'helper', name: 'Helper' },
        { storeId, slug: 'packer', name: 'Packer' },
      ])
      .returning()
    const roleId = (slug: string) => roles.find((r) => r.slug === slug)?.id as string
    await owner
      .insert(rolePermission)
      .values({ storeId, roleId: roleId('helper'), permission: 'inbox.reply' })
    await owner.insert(storeMember).values([
      { storeId, userId: 'u-owner', roleId: roleId('owner') },
      { storeId, userId: 'u-helper', roleId: roleId('helper') },
      { storeId, userId: 'u-packer', roleId: roleId('packer') },
    ])
    const people = await inStore(storeId, (ctx) => inboxAssignees(ctx.tx))
    expect(people.map((p) => p.userId).sort()).toEqual(['u-helper', 'u-owner'])

    const a = await say({ customerId: null, visitorKeyHash: hashChatToken(newChatToken()) }, 'A')
    await say({ customerId: null, visitorKeyHash: hashChatToken(newChatToken()) }, 'B')
    await inStore(storeId, (ctx) =>
      staffSend(ctx, { conversationId: a.conversation.id, body: 'Hi' }, 'u-helper'),
    )
    const unread = await inStore(storeId, (ctx) =>
      listConversations(ctx, { view: 'unread' }, { userId: 'u-helper', secret: SECRET }),
    )
    expect(unread.rows).toHaveLength(1)
    expect((await inStore(storeId, (ctx) => inboxCounts(ctx, 'u-helper'))).unread).toBe(1)
    const metrics = await inStore(storeId, (ctx) => inboxMetrics(ctx))
    expect(metrics).toMatchObject({ conversations: 2, messages: 3, answered: 1 })
    expect(metrics.medianFirstResponseMinutes).toBe(0)
  })
})
