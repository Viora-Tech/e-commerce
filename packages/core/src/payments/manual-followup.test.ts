import {
  cart,
  cartLine,
  createDb,
  inventoryLevel,
  notification,
  order,
  orderNote,
  outboxEvent,
  payment,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { Message, NotificationChannel } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { deliverNotification } from '../notifications/deliver'
import { builtInNotificationRegistry } from '../notifications/settings'
import { placeOrderAndPay } from '../order/place-order'
import { ManualPaymentProvider } from '../providers/manual'
import { applyPaymentStatus } from './confirm'
import {
  cancelNoticeHours,
  manualCancelAt,
  nextManualStep,
  noteChatPaymentReminder,
  PaymentNotPending,
  ReminderTooSoon,
  runManualFollowUp,
  sendManualPaymentReminder,
} from './manual-followup'
import { manualCancelHoursOf, parsePaymentSettings } from './settings'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const HOUR = 3_600_000
const NOW = new Date('2026-09-24T12:00:00Z')
const hoursAfter = (h: number) => new Date(NOW.getTime() + h * HOUR)
const transfer = new ManualPaymentProvider({ upiId: 'shop@hdfcbank', payeeName: 'Shop' })

/**
 * `manualCancelAfterHours` undefined leaves the store on the defaults (auto-cancel on, 6
 * hours); `off` is a store whose merchant turned it off.
 */
async function seedStore(slug: string, manualCancelAfterHours?: number, choice?: 'on' | 'off') {
  const [s] = await owner
    .insert(store)
    .values({
      slug,
      name: slug,
      contactEmail: `owner@${slug}.test`,
      payments:
        manualCancelAfterHours === undefined
          ? null
          : {
              enabled: ['manual'],
              providers: {},
              adjustments: {},
              manualCancelAfterHours,
              ...(choice ? { manualAutoCancel: choice } : {}),
            },
    })
    .returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mouse', title: 'Mouse', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Black', pricePaise: 10000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 5 })
  return { storeId: s.id, variantId: v.id }
}

/** A one-unit transfer order placed at NOW, shopper email and phone on it. */
async function transferOrder(shop: { storeId: string; variantId: string }) {
  const [c] = await owner.insert(cart).values({ storeId: shop.storeId }).returning()
  if (!c) throw new Error('seed')
  await owner.insert(cartLine).values({
    storeId: shop.storeId,
    cartId: c.id,
    variantId: shop.variantId,
    quantity: 1,
    unitPricePaise: 10000,
  })
  const r = await placeOrderAndPay(app, shop.storeId, { cartId: c.id, paymentProvider: transfer })
  await owner
    .update(order)
    .set({ placedAt: NOW, email: 'asha@example.com', phone: '919876543210' })
    .where(eq(order.id, r.orderId))
  return r.orderId
}

const events = async (orderId: string) =>
  (await owner.select().from(outboxEvent))
    .filter((e) => (e.payload as { orderId: string }).orderId === orderId)
    .map((e) => e.type)

const orderRow = async (orderId: string) =>
  (await owner.select().from(order).where(eq(order.id, orderId)))[0]

const reserved = async (variantId: string) =>
  (await owner.select().from(inventoryLevel).where(eq(inventoryLevel.variantId, variantId)))[0]
    ?.reserved

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

describe('nextManualStep', () => {
  const placed = { placedAt: NOW, cancelNoticeAt: null }

  it('does nothing while auto-cancel is off', () => {
    expect(nextManualStep(0, placed, hoursAfter(1000))).toBeNull()
  })

  it('tells the merchant 12 hours ahead, then cancels no sooner than 12 hours after that', () => {
    expect(nextManualStep(48, placed, hoursAfter(35))).toBeNull()
    expect(nextManualStep(48, placed, hoursAfter(36))).toBe('notice')
    const noticed = { placedAt: NOW, cancelNoticeAt: hoursAfter(36) }
    expect(nextManualStep(48, noticed, hoursAfter(47))).toBeNull()
    expect(nextManualStep(48, noticed, hoursAfter(48))).toBe('cancel')
    // Turned on for an old order: the notice goes now and the cancel waits the full 12 hours.
    const late = { placedAt: NOW, cancelNoticeAt: hoursAfter(100) }
    expect(nextManualStep(48, late, hoursAfter(111))).toBeNull()
    expect(nextManualStep(48, late, hoursAfter(112))).toBe('cancel')
  })

  it('under a day, tells the merchant halfway through and cancels at the window', () => {
    expect(nextManualStep(6, placed, hoursAfter(2.9))).toBeNull()
    expect(nextManualStep(6, placed, hoursAfter(3))).toBe('notice')
    const noticed = { placedAt: NOW, cancelNoticeAt: hoursAfter(3) }
    expect(nextManualStep(6, noticed, hoursAfter(5.9))).toBeNull()
    expect(nextManualStep(6, noticed, hoursAfter(6))).toBe('cancel')
    expect(manualCancelAt(6, noticed)).toEqual(hoursAfter(6))
    // A one hour window: notice at 30 minutes, cancel at the hour.
    expect(nextManualStep(1, placed, hoursAfter(0.5))).toBe('notice')
    // Noticed late (the window was shortened): the cancel still waits half the window.
    const late = { placedAt: NOW, cancelNoticeAt: hoursAfter(10) }
    expect(manualCancelAt(6, late)).toEqual(hoursAfter(13))
  })
})

describe('notice and window settings', () => {
  it('gives 12 hours of notice from a day up, half the window under it', () => {
    expect(cancelNoticeHours(72)).toBe(12)
    expect(cancelNoticeHours(24)).toBe(12)
    expect(cancelNoticeHours(23)).toBe(11.5)
    expect(cancelNoticeHours(6)).toBe(3)
  })

  it('is on at 6 hours unless the merchant turned it off, and stays within 1 to 72', () => {
    const at = (s: unknown) => manualCancelHoursOf(parsePaymentSettings(s))
    expect(at(null)).toBe(6)
    // Every payments save used to write 0: without a choice, that is the default too.
    expect(at({ manualCancelAfterHours: 0 })).toBe(6)
    expect(at({ manualCancelAfterHours: 48 })).toBe(48)
    expect(at({ manualCancelAfterHours: 720 })).toBe(72)
    expect(at({ manualAutoCancel: 'off', manualCancelAfterHours: 48 })).toBe(0)
    expect(at({ manualAutoCancel: 'on', manualCancelAfterHours: 0 })).toBe(6)
    expect(at({ manualAutoCancel: 'on', manualCancelAfterHours: 12 })).toBe(12)
  })
})

describe('merchant payment reminder', () => {
  it('sends on demand, at most once every 6 hours, and never on a paid order', async () => {
    const shop = await seedStore('a')
    const orderId = await transferOrder(shop)
    const send = (at: Date) =>
      withStore(app, shop.storeId, (tx) =>
        sendManualPaymentReminder({ storeId: shop.storeId, tx }, orderId, {
          author: 'owner@a.test',
          now: at,
        }),
      )

    expect(await send(hoursAfter(2))).toEqual({ sentAt: hoursAfter(2) })
    expect((await orderRow(orderId))?.paymentReminderSentAt).toEqual(hoursAfter(2))
    const tooSoon = await send(hoursAfter(7)).catch((e: unknown) => e)
    expect(tooSoon).toBeInstanceOf(ReminderTooSoon)
    expect((tooSoon as ReminderTooSoon).nextAt).toEqual(hoursAfter(8))
    await send(hoursAfter(8))
    expect(await events(orderId)).toEqual(
      expect.arrayContaining(['order.payment_reminder', 'order.payment_reminder']),
    )
    expect((await events(orderId)).filter((t) => t === 'order.payment_reminder')).toHaveLength(2)
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes.filter((n) => n.author === 'owner@a.test')).toHaveLength(2)

    await owner
      .update(order)
      .set({ paymentStatus: 'paid', checkoutPaidAt: new Date() })
      .where(eq(order.id, orderId))
    await expect(send(hoursAfter(20))).rejects.toBeInstanceOf(PaymentNotPending)
  })

  it('emails and WhatsApps the shopper the payment details, but not once the order is paid', async () => {
    const shop = await seedStore('a')
    const orderId = await transferOrder(shop)
    const email = recorder('mail', 'email')
    const phone = recorder('wa', 'phone')
    const run = () =>
      withStore(app, shop.storeId, (tx) =>
        deliverNotification(
          { storeId: shop.storeId, tx },
          { orderId, template: 'payment_reminder' },
          {
            registry: builtInNotificationRegistry(),
            settingsSecret: 'x',
            storefrontUrl: 'https://shop.test',
            channels: [email, phone],
          },
        ),
      )
    expect((await run()).map((r) => r.to)).toEqual(['asha@example.com', '919876543210'])
    expect(email.sent[0]?.data.orderUrl).toMatch(/^https:\/\/shop\.test\/checkout\/thank-you\//)
    await owner
      .update(order)
      .set({ paymentStatus: 'paid', checkoutPaidAt: new Date() })
      .where(eq(order.id, orderId))
    await owner.delete(notification)
    expect(await run()).toEqual([])
  })
})

describe('reminder channel', () => {
  it('sends "both" on WhatsApp alone when the order has no email', async () => {
    const shop = await seedStore('a')
    const orderId = await transferOrder(shop)
    await owner.update(order).set({ email: null }).where(eq(order.id, orderId))
    await withStore(app, shop.storeId, (tx) =>
      sendManualPaymentReminder({ storeId: shop.storeId, tx }, orderId, {
        whatsapp: true,
        now: hoursAfter(1),
      }),
    )
    const [row] = (await owner.select().from(outboxEvent)).filter(
      (e) => e.type === 'order.payment_reminder',
    )
    expect(row?.payload).toMatchObject({ requires: 'phone' })
  })

  it('leaves "both" open to every channel when the order has an email and a phone', async () => {
    const shop = await seedStore('a')
    const orderId = await transferOrder(shop)
    await withStore(app, shop.storeId, (tx) =>
      sendManualPaymentReminder({ storeId: shop.storeId, tx }, orderId, {
        whatsapp: true,
        now: hoursAfter(1),
      }),
    )
    const [row] = (await owner.select().from(outboxEvent)).filter(
      (e) => e.type === 'order.payment_reminder',
    )
    expect(row?.payload).not.toHaveProperty('requires')
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes.map((n) => n.body)).toEqual([
      'Payment reminder sent to the customer by email and WhatsApp.',
    ])
  })

  it('queues a WhatsApp-only reminder and says so on the timeline', async () => {
    const shop = await seedStore('a')
    const orderId = await transferOrder(shop)
    await withStore(app, shop.storeId, (tx) =>
      sendManualPaymentReminder({ storeId: shop.storeId, tx }, orderId, {
        author: 'owner@a.test',
        channel: 'whatsapp',
        whatsapp: true,
        now: hoursAfter(1),
      }),
    )
    const rows = (await owner.select().from(outboxEvent)).filter(
      (e) => e.type === 'order.payment_reminder',
    )
    expect(rows.map((r) => r.payload)).toEqual([
      expect.objectContaining({ orderId, requires: 'phone' }),
    ])
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes.map((n) => n.body)).toEqual(['Payment reminder sent to the customer on WhatsApp.'])
  })

  it('sends "both" by email only when the store has no WhatsApp', async () => {
    const shop = await seedStore('a')
    const orderId = await transferOrder(shop)
    await withStore(app, shop.storeId, (tx) =>
      sendManualPaymentReminder({ storeId: shop.storeId, tx }, orderId, {
        channel: 'both',
        whatsapp: false,
        now: hoursAfter(1),
      }),
    )
    const [row] = (await owner.select().from(outboxEvent)).filter(
      (e) => e.type === 'order.payment_reminder',
    )
    expect(row?.payload).toMatchObject({ requires: 'email' })
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes.map((n) => n.body)).toEqual(['Payment reminder sent to the customer by email.'])
  })

  it('refuses WhatsApp without a WhatsApp channel, and uses up nothing', async () => {
    const shop = await seedStore('a')
    const orderId = await transferOrder(shop)
    await expect(
      withStore(app, shop.storeId, (tx) =>
        sendManualPaymentReminder({ storeId: shop.storeId, tx }, orderId, {
          channel: 'whatsapp',
          whatsapp: false,
          now: hoursAfter(1),
        }),
      ),
    ).rejects.toMatchObject({ code: 'REMINDER_NO_RECIPIENT' })
    expect((await orderRow(orderId))?.paymentReminderSentAt).toBeNull()
    expect(await events(orderId)).not.toContain('order.payment_reminder')
  })

  it('delivers a WhatsApp-only reminder on the phone channel alone', async () => {
    const shop = await seedStore('a')
    const orderId = await transferOrder(shop)
    const email = recorder('mail', 'email')
    const phone = recorder('wa', 'phone')
    const sent = await withStore(app, shop.storeId, (tx) =>
      deliverNotification(
        { storeId: shop.storeId, tx },
        { orderId, template: 'payment_reminder' },
        {
          registry: builtInNotificationRegistry(),
          settingsSecret: 'x',
          storefrontUrl: 'https://shop.test',
          channels: [email, phone],
          requires: 'phone',
        },
      ),
    )
    expect(sent).toEqual([{ channel: 'wa', to: '919876543210', ok: true }])
    expect(email.sent).toEqual([])
    expect(phone.sent[0]?.data.orderUrl).toMatch(/^https:\/\/shop\.test\//)
  })

  it("notes a reminder sent from the merchant's own WhatsApp, but not on a paid order", async () => {
    const shop = await seedStore('a')
    const orderId = await transferOrder(shop)
    const note = () =>
      withStore(app, shop.storeId, (tx) =>
        noteChatPaymentReminder({ storeId: shop.storeId, tx }, orderId, { author: 'owner@a.test' }),
      )
    expect(await note()).toBe(true)
    expect((await orderRow(orderId))?.paymentReminderSentAt).toBeNull()
    await owner
      .update(order)
      .set({ paymentStatus: 'paid', checkoutPaidAt: new Date() })
      .where(eq(order.id, orderId))
    expect(await note()).toBe(false)
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes.map((n) => n.body)).toEqual([
      'Payment reminder opened in WhatsApp to send from your own number.',
    ])
  })
})

describe('auto-cancel', () => {
  it('stays off for a store that turned it off: an old unpaid transfer order is left alone', async () => {
    const shop = await seedStore('a', 0, 'off')
    const orderId = await transferOrder(shop)
    expect(await runManualFollowUp(app, shop.storeId, hoursAfter(500))).toEqual([])
    expect((await orderRow(orderId))?.status).toBe('open')
    expect(await events(orderId)).not.toContain('order.unpaid_cancel_notice')
  })

  it('is on by default: notice at 3 hours, cancelled at 6', async () => {
    const shop = await seedStore('a')
    const orderId = await transferOrder(shop)
    expect(await runManualFollowUp(app, shop.storeId, hoursAfter(2.5))).toEqual([])
    expect(await runManualFollowUp(app, shop.storeId, hoursAfter(3))).toEqual([
      { orderId, result: 'noticed' },
    ])
    expect(await runManualFollowUp(app, shop.storeId, hoursAfter(5.5))).toEqual([])
    expect(await runManualFollowUp(app, shop.storeId, hoursAfter(6))).toEqual([
      { orderId, result: 'cancelled' },
    ])
    expect((await orderRow(orderId))?.status).toBe('cancelled')
  })

  it('tells the merchant once, then cancels once and releases the stock', async () => {
    const shop = await seedStore('a', 48)
    const orderId = await transferOrder(shop)
    expect(await reserved(shop.variantId)).toBe(1)

    expect(await runManualFollowUp(app, shop.storeId, hoursAfter(30))).toEqual([])
    expect(await runManualFollowUp(app, shop.storeId, hoursAfter(37))).toEqual([
      { orderId, result: 'noticed' },
    ])
    expect(await runManualFollowUp(app, shop.storeId, hoursAfter(38))).toEqual([])
    expect(await events(orderId)).toContain('order.unpaid_cancel_notice')

    // The notice goes to the merchant's contact email only, never to the shopper.
    const email = recorder('mail', 'email')
    const phone = recorder('wa', 'phone')
    const sent = await withStore(app, shop.storeId, (tx) =>
      deliverNotification(
        { storeId: shop.storeId, tx },
        { orderId, template: 'unpaid_cancel_notice' },
        { registry: builtInNotificationRegistry(), settingsSecret: 'x', channels: [email, phone] },
      ),
    )
    expect(sent).toEqual([{ channel: 'mail', to: 'owner@a.test', ok: true }])
    expect(email.sent[0]?.data.deadlineLabel).toBeTruthy()
    expect(phone.sent).toEqual([])

    expect(await runManualFollowUp(app, shop.storeId, hoursAfter(49))).toEqual([
      { orderId, result: 'cancelled' },
    ])
    expect((await orderRow(orderId))?.status).toBe('cancelled')
    expect(await reserved(shop.variantId)).toBe(0)
    expect(await events(orderId)).toEqual(
      expect.arrayContaining(['order.cancelled', 'order.unpaid_cancelled']),
    )
    const [p] = await owner.select().from(payment).where(eq(payment.orderId, orderId))
    expect(p?.status).toBe('cancelled')

    expect(await runManualFollowUp(app, shop.storeId, hoursAfter(60))).toEqual([])
    expect((await events(orderId)).filter((t) => t === 'order.unpaid_cancelled')).toHaveLength(1)
    expect(await reserved(shop.variantId)).toBe(0)
  })

  it('marking the order paid after the notice stops the cancel', async () => {
    const shop = await seedStore('a', 48)
    const orderId = await transferOrder(shop)
    await runManualFollowUp(app, shop.storeId, hoursAfter(37))
    const [p] = await owner.select().from(payment).where(eq(payment.orderId, orderId))
    if (!p) throw new Error('no attempt')
    await withStore(app, shop.storeId, (tx) =>
      applyPaymentStatus(
        { storeId: shop.storeId, tx },
        { paymentId: p.id, status: 'captured', providerPaymentId: null },
      ),
    )
    expect(await runManualFollowUp(app, shop.storeId, hoursAfter(60))).toEqual([])
    expect((await orderRow(orderId))?.paymentStatus).toBe('paid')
    expect(await reserved(shop.variantId)).toBe(1)
  })

  it("follows each store's own setting and never touches another store's orders", async () => {
    const a = await seedStore('a', 48)
    const b = await seedStore('b', 0, 'off')
    const orderA = await transferOrder(a)
    const orderB = await transferOrder(b)
    await runManualFollowUp(app, a.storeId, hoursAfter(37))
    await runManualFollowUp(app, b.storeId, hoursAfter(37))
    expect(await runManualFollowUp(app, a.storeId, hoursAfter(49))).toEqual([
      { orderId: orderA, result: 'cancelled' },
    ])
    expect(await runManualFollowUp(app, b.storeId, hoursAfter(49))).toEqual([])
    expect((await orderRow(orderB))?.status).toBe('open')
    expect((await orderRow(orderB))?.unpaidCancelNoticeAt).toBeNull()
    await expect(
      withStore(app, b.storeId, (tx) =>
        sendManualPaymentReminder({ storeId: b.storeId, tx }, orderA, { now: hoursAfter(50) }),
      ),
    ).rejects.toBeInstanceOf(PaymentNotPending)
  })
})
