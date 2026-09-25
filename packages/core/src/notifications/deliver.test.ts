import {
  createDb,
  customer,
  notification,
  order,
  orderLine,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { Message, NotificationChannel } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { buildTemplateData, deliverNotification } from './deliver'
import { enqueueNotification, type NotificationJob, notificationJobId } from './enqueue'
import {
  builtInNotificationRegistry,
  encryptNotificationSettings,
  maskNotificationSettings,
  parseNotificationSettings,
  resolveNotificationChannels,
} from './settings'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const registry = builtInNotificationRegistry()
const secret = 'test-settings-secret'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** A channel that records what it was asked to send and can be told to fail. */
function recorder(
  id: string,
  requires: 'email' | 'phone',
  failFirst = false,
): NotificationChannel & {
  sent: Message[]
} {
  let calls = 0
  return {
    id,
    label: id,
    requires,
    sent: [],
    async send(m) {
      calls += 1
      if (failFirst && calls === 1) return { ok: false, error: 'boom' }
      this.sent.push(m)
      return { ok: true, providerRef: `${id}_${calls}` }
    },
  }
}

async function seedOrder(opts: { phone?: string } = {}) {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [cu] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: 'asha@example.com', name: 'Asha' })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId: s.id,
      number: 7,
      status: 'open',
      subtotalPaise: 199900,
      totalPaise: 204800,
      paymentMethod: 'cod',
      email: 'asha@example.com',
      phone: opts.phone ?? null,
      customerId: cu?.id ?? null,
    })
    .returning()
  if (!o) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'p', title: 'Pad', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'Default', pricePaise: 199900 })
    .returning()
  await owner.insert(orderLine).values({
    storeId: s.id,
    orderId: o.id,
    variantId: v?.id as string,
    title: 'Pad',
    variantTitle: 'Default',
    quantity: 1,
    unitPricePaise: 199900,
  })
  return { storeId: s.id, orderId: o.id }
}

describe('notification settings', () => {
  it('encrypts tokens, masks them, and resolves the built-in log channel', () => {
    const s = parseNotificationSettings({
      enabled: ['log', 'whatsapp'],
      providers: { whatsapp: { phoneNumberId: '1', accessToken: 'tok_secret' } },
    })
    const enc = encryptNotificationSettings(s, secret)
    expect(enc.providers.whatsapp?.accessToken).toMatch(/^v2\./)
    expect(maskNotificationSettings(s).providers.whatsapp?.accessToken).toBe('••••cret')
    const r = resolveNotificationChannels(registry, enc, secret)
    expect(r.channels.map((c) => c.id)).toEqual(['log'])
    expect(r.errors).toEqual(['whatsapp: unknown notification channel: whatsapp'])
  })
})

describe('enqueueNotification', () => {
  it('uses a deterministic job id so repeats collapse', async () => {
    const added: unknown[] = []
    const queue = { add: async (...a: unknown[]) => added.push(a) }
    const job: NotificationJob = { storeId: 's', orderId: 'o', template: 'order_placed' }
    await enqueueNotification(queue, job)
    expect(added[0]).toEqual([
      'order_placed',
      job,
      { jobId: notificationJobId(job), attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    ])
  })
})

describe('deliverNotification', () => {
  it('builds template data from the order row', async () => {
    const { storeId, orderId } = await seedOrder()
    const built = await withStore(app, storeId, (tx) =>
      buildTemplateData({ storeId, tx }, orderId, 'https://shop.test', secret),
    )
    expect(built?.data).toMatchObject({
      storeName: 'Waimers',
      orderNumber: 7,
      customerName: 'Asha',
      totalLabel: '₹2,048',
      paymentMethodLabel: 'Cash on delivery',
    })
    // Signed, unguessable order token — never just the sequential number.
    expect(built?.data.orderUrl).toMatch(/^https:\/\/shop\.test\/checkout\/thank-you\/7\?t=.+/)
    expect(built?.data.lines).toEqual([{ title: 'Pad', quantity: 1, priceLabel: '₹1,999' }])
  })

  it('sends through every channel with a recipient and records a row each', async () => {
    const { storeId, orderId } = await seedOrder()
    const email = recorder('mail', 'email')
    const phone = recorder('wa', 'phone')
    const results = await withStore(app, storeId, (tx) =>
      deliverNotification(
        { storeId, tx },
        { orderId, template: 'order_placed' },
        { registry, settingsSecret: secret, channels: [email, phone] },
      ),
    )
    expect(results).toEqual([{ channel: 'mail', to: 'asha@example.com', ok: true }])
    expect(email.sent[0]?.template).toBe('order_placed')
    expect(phone.sent).toEqual([])
    const rows = await owner.select().from(notification)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ channel: 'mail', status: 'sent', providerRef: 'mail_1' })
  })

  it('records a failure, then only retries the failed channel', async () => {
    const { storeId, orderId } = await seedOrder()
    const flaky = recorder('mail', 'email', true)
    const run = () =>
      withStore(app, storeId, (tx) =>
        deliverNotification(
          { storeId, tx },
          { orderId, template: 'payment_received' },
          { registry, settingsSecret: secret, channels: [flaky] },
        ),
      )
    expect(await run()).toEqual([
      { channel: 'mail', to: 'asha@example.com', ok: false, error: 'boom' },
    ])
    expect((await owner.select().from(notification))[0]).toMatchObject({
      status: 'failed',
      error: 'boom',
    })
    expect(await run()).toEqual([{ channel: 'mail', to: 'asha@example.com', ok: true }])
    const rows = await owner.select().from(notification)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ status: 'sent', providerRef: 'mail_2', error: null })
    expect(await run()).toEqual([]) // already sent: nothing to do
    expect(flaky.sent).toHaveLength(1)
  })

  it('resolves channels from store settings when none are injected', async () => {
    const { storeId, orderId } = await seedOrder()
    await owner
      .update(store)
      .set({ notifications: { enabled: ['log'], providers: {} } })
      .where(eq(store.id, storeId))
    const results = await withStore(app, storeId, (tx) =>
      deliverNotification(
        { storeId, tx },
        { orderId, template: 'order_shipped' },
        { registry, settingsSecret: secret },
      ),
    )
    expect(results).toEqual([{ channel: 'log', to: 'asha@example.com', ok: true }])
  })
})
