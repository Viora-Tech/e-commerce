/** SOURCE OF TRUTH: tests for "Send payment link" on a checkout draft — WHAT: the channels chosen, a missing email or phone, the timeline line, the 10-minute limit per channel, and the link delivery fills / WHY: staff send the shopper their pay link from the draft page */
import {
  cart,
  cartLine,
  createDb,
  inventoryLevel,
  order,
  orderNote,
  outboxEvent,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { Message, NotificationChannel } from '@commerce/notifications'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { deliverNotification } from '../notifications/deliver'
import { builtInNotificationRegistry } from '../notifications/settings'
import { GatewayDouble } from '../payments/gateway-double.test-util'
import type { ReminderChannel } from '../payments/manual-followup'
import { PayLinkTooSoon, sendCheckoutDraftPayLink } from './checkout-draft-pay-link'
import { placeOrderAndPay } from './place-order'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

const MINUTE = 60_000
const NOW = new Date('2026-11-12T10:00:00Z')
const minutesAfter = (m: number) => new Date(NOW.getTime() + m * MINUTE)
const STAFF = 'priya@waimers.test'

async function checkoutDraft(): Promise<{ storeId: string; orderId: string }> {
  const [s] = await owner
    .insert(store)
    .values({ slug: 'waimers', name: 'Waimers', payments: { unpaidAsDrafts: 'on' } })
    .returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'keyboard', title: 'Keyboard', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Keyboard', pricePaise: 250000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 5 })
  const [c] = await owner.insert(cart).values({ storeId: s.id }).returning()
  if (!c) throw new Error('seed')
  await owner
    .insert(cartLine)
    .values({ storeId: s.id, cartId: c.id, variantId: v.id, quantity: 1, unitPricePaise: 250000 })
  const r = await placeOrderAndPay(app, s.id, {
    cartId: c.id,
    paymentProvider: new GatewayDouble(),
    checkout: {
      name: 'Rudra',
      email: 'rudra@example.com',
      phone: '9876543210',
      address: { line1: '12 MG Road', city: 'Bengaluru', stateCode: 'KA', pincode: '560001' },
    },
  })
  const [o] = await owner.select().from(order).where(eq(order.id, r.orderId))
  expect(o).toMatchObject({ status: 'draft', draftSource: 'checkout' })
  return { storeId: s.id, orderId: r.orderId }
}

function send(
  shop: { storeId: string; orderId: string },
  opts: { channel?: ReminderChannel; whatsapp?: boolean; at?: Date } = {},
) {
  return withStore(app, shop.storeId, (tx) =>
    sendCheckoutDraftPayLink({ storeId: shop.storeId, tx }, shop.orderId, {
      author: STAFF,
      channel: opts.channel,
      whatsapp: opts.whatsapp ?? true,
      custom: { message: 'Here is your link' },
      now: opts.at ?? NOW,
    }),
  )
}

const linkEvents = (orderId: string) =>
  owner
    .select()
    .from(outboxEvent)
    .where(eq(outboxEvent.type, 'draft.invoice_sent'))
    .then((rows) => rows.filter((r) => (r.payload as { orderId?: string }).orderId === orderId))

const linkNotes = (orderId: string) =>
  owner
    .select()
    .from(orderNote)
    .where(eq(orderNote.orderId, orderId))
    .then((rows) => rows.filter((n) => n.body.startsWith('Payment link sent')))

function recorder(
  id: string,
  requires: 'email' | 'phone',
): NotificationChannel & { sent: Message[] } {
  return {
    id,
    label: id,
    requires,
    sent: [],
    async send(m) {
      this.sent.push(m)
      return { ok: true, providerRef: `${id}_${this.sent.length}` }
    },
  }
}

describe('sendCheckoutDraftPayLink', () => {
  it('counts each channel by its own line, whatever the staff address says', async () => {
    const shop = await checkoutDraft()
    const as = (author: string, channel: ReminderChannel, at: Date) =>
      withStore(app, shop.storeId, (tx) =>
        sendCheckoutDraftPayLink({ storeId: shop.storeId, tx }, shop.orderId, {
          author,
          channel,
          whatsapp: true,
          now: at,
        }),
      )
    // "whatsapp@" in the address of an email send does not block WhatsApp, and back.
    await as('whatsapp@waimers.test', 'email', NOW)
    await as('email@waimers.test', 'whatsapp', minutesAfter(1))
    await expect(as('x@waimers.test', 'email', minutesAfter(2))).rejects.toMatchObject({
      channel: 'email',
    })
    // Other timeline lines never count.
    await owner.insert(orderNote).values({
      storeId: shop.storeId,
      orderId: shop.orderId,
      body: 'Shopper checked out again',
      author: 'system',
      createdAt: minutesAfter(11),
    })
    expect((await as('x@waimers.test', 'both', minutesAfter(12))).channel).toBe('both')
  })

  it('sends on both channels by default and notes who sent it on the timeline', async () => {
    const shop = await checkoutDraft()
    expect(await send(shop)).toEqual({ channel: 'both', sentAt: NOW })

    const [event, ...more] = await linkEvents(shop.orderId)
    expect(more).toEqual([])
    expect(event?.payload).toEqual({
      orderId: shop.orderId,
      custom: { message: 'Here is your link' },
    })
    const notes = await linkNotes(shop.orderId)
    expect(notes).toMatchObject([
      { body: `Payment link sent by email and WhatsApp by ${STAFF}`, author: STAFF },
    ])
  })

  it('limits the send to the one channel chosen', async () => {
    const shop = await checkoutDraft()
    expect((await send(shop, { channel: 'email' })).channel).toBe('email')
    expect((await send(shop, { channel: 'whatsapp' })).channel).toBe('whatsapp')
    const payloads = (await linkEvents(shop.orderId)).map((e) => e.payload)
    expect(payloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ requires: 'email' }),
        expect.objectContaining({ requires: 'phone' }),
      ]),
    )
    expect((await linkNotes(shop.orderId)).map((n) => n.body)).toEqual(
      expect.arrayContaining([
        `Payment link sent by email by ${STAFF}`,
        `Payment link sent by WhatsApp by ${STAFF}`,
      ]),
    )
  })

  it('falls back to what the draft and the store have, and refuses when nothing is left', async () => {
    const shop = await checkoutDraft()
    // No WhatsApp connected: "both" becomes email; WhatsApp alone cannot go.
    expect((await send(shop, { whatsapp: false })).channel).toBe('email')
    await expect(
      send(shop, { channel: 'whatsapp', whatsapp: false, at: minutesAfter(30) }),
    ).rejects.toMatchObject({ code: 'PAY_LINK_NO_RECIPIENT' })

    // No email on the draft: WhatsApp only, and an email-only send is refused.
    await owner.update(order).set({ email: null }).where(eq(order.id, shop.orderId))
    expect((await send(shop, { at: minutesAfter(60) })).channel).toBe('whatsapp')
    await expect(send(shop, { channel: 'email', at: minutesAfter(90) })).rejects.toMatchObject({
      code: 'PAY_LINK_NO_RECIPIENT',
    })

    // Neither: nothing to send to.
    await owner.update(order).set({ phone: null }).where(eq(order.id, shop.orderId))
    await expect(send(shop, { at: minutesAfter(120) })).rejects.toMatchObject({
      code: 'PAY_LINK_NO_RECIPIENT',
    })
    expect(await linkEvents(shop.orderId)).toHaveLength(2)
    expect(await linkNotes(shop.orderId)).toHaveLength(2)
  })

  it('sends once per channel every 10 minutes, with the time it may go again', async () => {
    const shop = await checkoutDraft()
    await send(shop, { channel: 'email' })

    const again = send(shop, { channel: 'email', at: minutesAfter(4) })
    await expect(again).rejects.toBeInstanceOf(PayLinkTooSoon)
    await expect(again).rejects.toMatchObject({
      code: 'PAY_LINK_TOO_SOON',
      channel: 'email',
      nextAt: minutesAfter(10),
    })
    // "Both" includes the email that just went, so it waits too.
    await expect(send(shop, { at: minutesAfter(5) })).rejects.toMatchObject({ channel: 'email' })
    // WhatsApp has its own clock.
    expect((await send(shop, { channel: 'whatsapp', at: minutesAfter(5) })).channel).toBe(
      'whatsapp',
    )
    await expect(send(shop, { channel: 'whatsapp', at: minutesAfter(9) })).rejects.toMatchObject({
      channel: 'whatsapp',
      nextAt: minutesAfter(15),
    })
    // Ten minutes on, email may go again.
    expect((await send(shop, { channel: 'email', at: minutesAfter(10) })).channel).toBe('email')
    expect(await linkEvents(shop.orderId)).toHaveLength(3)
  })

  it('refuses a checkout draft that is no longer waiting, and a staff-made draft', async () => {
    const shop = await checkoutDraft()
    await owner.update(order).set({ draftExpiredAt: NOW }).where(eq(order.id, shop.orderId))
    await expect(send(shop)).rejects.toMatchObject({ code: 'NOT_OPEN_CHECKOUT_DRAFT' })

    await owner
      .update(order)
      .set({ draftExpiredAt: null, draftSource: null })
      .where(eq(order.id, shop.orderId))
    await expect(send(shop)).rejects.toMatchObject({ code: 'NOT_OPEN_CHECKOUT_DRAFT' })
    expect(await linkEvents(shop.orderId)).toEqual([])
  })
})

describe('delivering the payment link', () => {
  const deliver = (shop: { storeId: string; orderId: string }, channels: NotificationChannel[]) =>
    withStore(app, shop.storeId, (tx) =>
      deliverNotification(
        { storeId: shop.storeId, tx },
        { orderId: shop.orderId, template: 'draft_invoice' },
        {
          registry: builtInNotificationRegistry(),
          settingsSecret: 'x',
          storefrontUrl: 'https://shop.test',
          channels,
          resend: true,
        },
      ),
    )

  it("links the draft's own order page and reads as still waiting for payment", async () => {
    const shop = await checkoutDraft()
    const email = recorder('mail', 'email')
    const phone = recorder('wa', 'phone')
    const sent = await deliver(shop, [email, phone])
    expect(sent.map((r) => r.channel)).toEqual(['mail', 'wa'])
    const data = email.sent[0]?.data
    // The same signed link as "Copy payment link", never the staff invoice page.
    expect(data?.actionUrl).toMatch(/^https:\/\/shop\.test\/checkout\/thank-you\/D1\?t=/)
    expect(data?.reminder).toBe(true)
    expect(phone.sent[0]?.data.actionUrl).toBe(data?.actionUrl)
  })

  it('sends nothing once the checkout draft was paid or expired', async () => {
    const shop = await checkoutDraft()
    await owner.update(order).set({ draftExpiredAt: NOW }).where(eq(order.id, shop.orderId))
    const email = recorder('mail', 'email')
    expect(await deliver(shop, [email])).toEqual([])

    await owner
      .update(order)
      .set({ draftExpiredAt: null, status: 'open' })
      .where(and(eq(order.id, shop.orderId), eq(order.storeId, shop.storeId)))
    expect(await deliver(shop, [email])).toEqual([])
    expect(email.sent).toEqual([])
  })
})
