/** SOURCE OF TRUTH: WhatsApp delivery report and STOP reply tests — WHAT: a verified WhatsApp webhook saves delivered, read and failed on the message it names (never downgrading read), and a STOP reply turns that store's customer's WhatsApp consent off / WHY: the message log must show what Meta really did, and a shopper's opt-out must always win */
import {
  createDb,
  customer,
  marketingConsentEvent,
  notification,
  platformAccount,
  store,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { encryptCustomerPhone } from '../customers/phone-crypto'
import { handleMetaWebhook } from './meta-callbacks'
import { isOptOutReply, whatsappStatusReports } from './whatsapp-reports'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-settings-secret-test-settings-secret'
const NOW = new Date('2026-11-24T10:00:00Z')

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

let n = 0
async function seed() {
  const [s] = await owner
    .insert(store)
    .values({ slug: `wa-${++n}`, name: 'Waimers' })
    .returning()
  const storeId = s?.id as string
  await owner
    .insert(platformAccount)
    .values({ storeId, platform: 'whatsapp', externalId: `waba-${n}` })
  return { storeId, waba: `waba-${n}` }
}

const statusHook = (waba: string, statuses: Record<string, unknown>[]) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: waba, changes: [{ field: 'messages', value: { statuses } }] }],
})

const replyHook = (waba: string, from: string, body: string) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: waba,
      changes: [
        { field: 'messages', value: { messages: [{ from, type: 'text', text: { body } }] } },
      ],
    },
  ],
})

const row = async (id: string) => {
  const [r] = await owner.select().from(notification).where(eq(notification.id, id))
  return r
}

describe('WhatsApp delivery reports', () => {
  it('reads delivered, read and failed; ignores sent', () => {
    const reports = whatsappStatusReports(
      {
        field: 'messages',
        value: {
          statuses: [
            { id: 'w1', status: 'sent' },
            { id: 'w1', status: 'delivered', timestamp: '1795400000' },
            { id: 'w2', status: 'failed', errors: [{ title: 'Message undeliverable' }] },
          ],
        },
      },
      NOW,
    )
    expect(reports.map((r) => [r.id, r.status, r.error])).toEqual([
      ['w1', 'delivered', null],
      ['w2', 'failed', 'Message undeliverable'],
    ])
  })

  it('saves the report on the message, never downgrades read, and a failure marks it failed', async () => {
    const { storeId, waba } = await seed()
    const [a, b] = await owner
      .insert(notification)
      .values([
        {
          storeId,
          channel: 'whatsapp',
          template: 'order_placed',
          to: '919876543210',
          status: 'sent',
          providerRef: 'wamid.A',
        },
        {
          storeId,
          channel: 'whatsapp',
          template: 'order_shipped',
          to: '919876543210',
          status: 'sent',
          providerRef: 'wamid.B',
        },
      ])
      .returning()
    await handleMetaWebhook(app, statusHook(waba, [{ id: 'wamid.A', status: 'read' }]), NOW, SECRET)
    await handleMetaWebhook(
      app,
      statusHook(waba, [{ id: 'wamid.A', status: 'delivered' }]),
      NOW,
      SECRET,
    )
    expect(await row(a?.id as string)).toMatchObject({ status: 'sent', deliveryStatus: 'read' })
    await handleMetaWebhook(
      app,
      statusHook(waba, [
        { id: 'wamid.B', status: 'failed', errors: [{ title: 'Not on WhatsApp' }] },
      ]),
      NOW,
      SECRET,
    )
    expect(await row(b?.id as string)).toMatchObject({
      status: 'failed',
      deliveryStatus: 'failed',
      error: 'Not on WhatsApp',
    })
  })

  it("never touches another store's message with the same id", async () => {
    const one = await seed()
    const two = await seed()
    const [m] = await owner
      .insert(notification)
      .values({
        storeId: two.storeId,
        channel: 'whatsapp',
        template: 'order_placed',
        to: '1',
        status: 'sent',
        providerRef: 'wamid.X',
      })
      .returning()
    await handleMetaWebhook(
      app,
      statusHook(one.waba, [{ id: 'wamid.X', status: 'failed' }]),
      NOW,
      SECRET,
    )
    expect((await row(m?.id as string))?.status).toBe('sent')
  })
})

describe('WhatsApp STOP replies', () => {
  it('knows the opt-out words, in any case, and nothing else', () => {
    expect(['STOP', ' stop ', 'Unsubscribe.', 'Stop all', 'opt-out'].map(isOptOutReply)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ])
    expect(
      ['stop sending the wrong size', 'cancel', 'when will it ship?'].map(isOptOutReply),
    ).toEqual([false, false, false])
  })

  it("turns WhatsApp consent off for that store's customer with the phone", async () => {
    const { storeId, waba } = await seed()
    const other = await seed()
    const phone = encryptCustomerPhone('+91 98765 43210', SECRET)
    const [c, d] = await owner
      .insert(customer)
      .values([
        {
          storeId,
          email: 'asha@example.com',
          phone: phone.cipher,
          phoneIndex: phone.index,
          acceptsWhatsapp: true,
        },
        {
          storeId: other.storeId,
          email: 'asha@example.com',
          phone: phone.cipher,
          phoneIndex: phone.index,
          acceptsWhatsapp: true,
        },
      ])
      .returning()
    await handleMetaWebhook(app, replyHook(waba, '919876543210', 'STOP'), NOW, SECRET)
    const consent = async (id: string) =>
      (await owner.select().from(customer).where(eq(customer.id, id)))[0]?.acceptsWhatsapp
    expect(await consent(c?.id as string)).toBe(false)
    expect(await consent(d?.id as string)).toBe(true)
    const [event] = await owner
      .select()
      .from(marketingConsentEvent)
      .where(eq(marketingConsentEvent.customerId, c?.id as string))
    expect(event).toMatchObject({ channel: 'whatsapp', granted: false, source: 'whatsapp_reply' })
    // A normal reply changes nothing.
    await handleMetaWebhook(
      app,
      replyHook(other.waba, '919876543210', 'Is it in stock?'),
      NOW,
      SECRET,
    )
    expect(await consent(d?.id as string)).toBe(true)
  })
})
