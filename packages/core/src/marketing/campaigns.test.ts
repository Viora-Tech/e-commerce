import {
  createDb,
  customer,
  customerSegment,
  marketingCampaign,
  marketingMessage,
  order,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { MarketingSend, NotificationChannel } from '@commerce/notifications'
import { NotificationRegistry } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { campaignAudience } from './audience'
import {
  CampaignLocked,
  CampaignNotReady,
  campaignStats,
  cancelCampaign,
  createCampaign,
  scheduleCampaign,
  sendCampaignBatch,
  startDueCampaigns,
  updateCampaign,
} from './campaigns'
import type { MarketingDeps } from './send'
import { verifyClickToken, verifyMessageToken } from './tokens'
import { recordMessageClick, recordMessageOpen, unsubscribeCustomer } from './tracking'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const TEST_SECRET = 'test-only-settings-secret-value'
const SECRET = 'test-secret-key'

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

/** Records marketing sends; `fail` makes one address fail. */
function recorder(fail?: string) {
  const sent: MarketingSend[] = []
  const email: NotificationChannel = {
    id: 'fake-email',
    label: 'Fake email',
    requires: 'email',
    send: async () => ({ ok: true, providerRef: 'x' }),
    sendMarketing: async (m) => {
      sent.push(m)
      if (m.kind === 'email' && m.to.email === fail) return { ok: false, error: 'bounced' }
      return { ok: true, providerRef: `ref-${sent.length}` }
    },
  }
  const whatsapp: NotificationChannel = {
    id: 'fake-wa',
    label: 'Fake WhatsApp',
    requires: 'phone',
    send: async () => ({ ok: true, providerRef: 'x' }),
    sendMarketing: async (m) => {
      sent.push(m)
      return { ok: true, providerRef: `wa-${sent.length}` }
    },
  }
  const deps: MarketingDeps = {
    registry: new NotificationRegistry(),
    settingsSecret: SECRET,
    storefrontUrl: 'https://shop.test',
    channels: [email, whatsapp],
  }
  return { sent, deps }
}

async function newStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: 'Waimers' }).returning()
  return s?.id as string
}

async function addCustomer(
  storeId: string,
  email: string,
  opts: Partial<typeof customer.$inferInsert> = {},
) {
  const [c] = await owner
    .insert(customer)
    .values({ storeId, email, name: 'Asha Menon', acceptsMarketing: true, ...opts })
    .returning()
  return c?.id as string
}

const content = {
  kind: 'email' as const,
  name: 'Diwali drop',
  segmentId: null,
  subject: 'Hi {first_name}',
  previewText: 'New pads',
  blocks: [
    { id: 'b1', type: 'text' as const, text: 'Hello', align: 'left' as const },
    { id: 'b2', type: 'button' as const, label: 'Shop', url: 'https://shop.test/collections/all' },
  ],
  whatsapp: null,
}

describe('campaign audience and consent', () => {
  it('reaches only consented, not unsubscribed customers, once per address', async () => {
    const storeId = await newStore('a')
    await addCustomer(storeId, 'yes@x.in')
    await addCustomer(storeId, 'no@x.in', { acceptsMarketing: false })
    await addCustomer(storeId, 'gone@x.in', { unsubscribedAt: new Date() })
    await addCustomer(storeId, 'wa@x.in', { acceptsWhatsapp: true, phone: '98765 43210' })
    await addCustomer(storeId, 'wa2@x.in', { acceptsWhatsapp: true, phone: '+91 98765 43210' })
    const email = await withStore(app, storeId, (tx) =>
      campaignAudience(tx, { kind: 'email', segmentId: null }, TEST_SECRET),
    )
    expect(email.map((m) => m.to).sort()).toEqual(['wa2@x.in', 'wa@x.in', 'yes@x.in'])
    const wa = await withStore(app, storeId, (tx) =>
      campaignAudience(tx, { kind: 'whatsapp', segmentId: null }, TEST_SECRET),
    )
    expect(wa.map((m) => m.to)).toEqual(['919876543210'])
  })

  it('narrows to a saved segment', async () => {
    const storeId = await newStore('b')
    const buyer = await addCustomer(storeId, 'buyer@x.in')
    await addCustomer(storeId, 'browser@x.in')
    await owner.insert(order).values({
      storeId,
      number: 1,
      customerId: buyer,
      subtotalPaise: 500000,
      totalPaise: 500000,
    })
    const [seg] = await owner
      .insert(customerSegment)
      .values({
        storeId,
        name: 'Buyers',
        rules: { match: 'all', conditions: [{ field: 'orders', op: 'gte', value: '1' }] },
      })
      .returning()
    const members = await withStore(app, storeId, (tx) =>
      campaignAudience(tx, { kind: 'email', segmentId: seg?.id as string }, TEST_SECRET),
    )
    expect(members.map((m) => m.to)).toEqual(['buyer@x.in'])
  })
})

describe('scheduling', () => {
  it('refuses to schedule an incomplete campaign and locks it once scheduled', async () => {
    const storeId = await newStore('c')
    const c = await withStore(app, storeId, (tx) =>
      createCampaign(tx, storeId, { ...content, subject: '' }),
    )
    await expect(
      withStore(app, storeId, (tx) => scheduleCampaign(tx, c?.id as string)),
    ).rejects.toBeInstanceOf(CampaignNotReady)
    await withStore(app, storeId, (tx) => updateCampaign(tx, storeId, c?.id as string, content))
    const at = new Date(Date.now() + 3_600_000)
    const scheduled = await withStore(app, storeId, (tx) =>
      scheduleCampaign(tx, c?.id as string, { at }),
    )
    expect(scheduled?.status).toBe('scheduled')
    await expect(
      withStore(app, storeId, (tx) => updateCampaign(tx, storeId, c?.id as string, content)),
    ).rejects.toBeInstanceOf(CampaignLocked)
  })

  it('starts only when due, and can be unscheduled before', async () => {
    const storeId = await newStore('d')
    await addCustomer(storeId, 'a@x.in')
    const c = await withStore(app, storeId, (tx) => createCampaign(tx, storeId, content))
    const id = c?.id as string
    const at = new Date(Date.now() + 3_600_000)
    await withStore(app, storeId, (tx) => scheduleCampaign(tx, id, { at }))
    expect(
      await withStore(app, storeId, (tx) => startDueCampaigns(tx, storeId, TEST_SECRET)),
    ).toEqual([])
    const back = await withStore(app, storeId, (tx) => cancelCampaign(tx, id))
    expect(back?.status).toBe('draft')

    await withStore(app, storeId, (tx) => scheduleCampaign(tx, id, { at }))
    const later = new Date(at.getTime() + 1000)
    expect(
      await withStore(app, storeId, (tx) => startDueCampaigns(tx, storeId, TEST_SECRET, later)),
    ).toEqual([id])
    const [row] = await owner.select().from(marketingCampaign).where(eq(marketingCampaign.id, id))
    expect(row).toMatchObject({ status: 'sending', audienceCount: 1 })
  })
})

describe('sending', () => {
  it('sends in batches with tracking and unsubscribe, then reports stats', async () => {
    const storeId = await newStore('e')
    for (let i = 0; i < 5; i++) await addCustomer(storeId, `c${i}@x.in`)
    const { sent, deps } = recorder('c3@x.in')
    const c = await withStore(app, storeId, (tx) => createCampaign(tx, storeId, content))
    const id = c?.id as string
    await withStore(app, storeId, (tx) => scheduleCampaign(tx, id))
    await withStore(app, storeId, (tx) => startDueCampaigns(tx, storeId, TEST_SECRET))

    const first = await withStore(app, storeId, (tx) => sendCampaignBatch(tx, storeId, deps, id, 3))
    expect(first).toEqual({ sent: 3, failed: 0, done: false })
    const second = await withStore(app, storeId, (tx) =>
      sendCampaignBatch(tx, storeId, deps, id, 3),
    )
    expect(second).toMatchObject({ failed: 1, done: true })
    expect(sent).toHaveLength(5)

    const mail = sent[0] as Extract<MarketingSend, { kind: 'email' }>
    expect(mail.subject).toBe('Hi Asha')
    expect(mail.headers?.map((h) => h.name)).toEqual(['List-Unsubscribe', 'List-Unsubscribe-Post'])
    expect(mail.html).toContain('https://shop.test/api/m/open/')
    expect(mail.html).toContain('https://shop.test/unsubscribe/')
    const click = /https:\/\/shop\.test\/api\/m\/click\/([^?"]+)\?u=([^"]+)"/.exec(mail.html)
    const target = decodeURIComponent((click?.[2] ?? '').replace(/&amp;/g, '&'))
    expect(target).toContain('utm_medium=email')
    expect(target).toContain('utm_campaign=diwali-drop')
    const payload = verifyClickToken(click?.[1] as string, target, SECRET)
    expect(payload?.storeId).toBe(storeId)
    expect(verifyClickToken(click?.[1] as string, 'https://evil.test/', SECRET)).toBeNull()

    const [row] = await owner.select().from(marketingCampaign).where(eq(marketingCampaign.id, id))
    expect(row?.status).toBe('sent')

    const msgs = await owner
      .select()
      .from(marketingMessage)
      .where(eq(marketingMessage.campaignId, id))
    const one = msgs.find((m) => m.status === 'sent') as (typeof msgs)[number]
    await withStore(app, storeId, async (tx) => {
      await recordMessageOpen(tx, one.id)
      await recordMessageClick(tx, one.id)
    })
    await owner.insert(order).values({
      storeId,
      number: 1,
      subtotalPaise: 250000,
      totalPaise: 250000,
      attribution: { channel: 'email', campaignId: id, at: new Date().toISOString() },
    })
    const stats = (await withStore(app, storeId, (tx) => campaignStats(tx, [id]))).get(id)
    expect(stats).toMatchObject({
      recipients: 5,
      sent: 4,
      failed: 1,
      opened: 1,
      clicked: 1,
      orders: 1,
      revenuePaise: 250000,
    })
  })

  it('skips a customer who unsubscribed after the campaign started', async () => {
    const storeId = await newStore('f')
    const a = await addCustomer(storeId, 'a@x.in')
    await addCustomer(storeId, 'b@x.in')
    const { sent, deps } = recorder()
    const c = await withStore(app, storeId, (tx) => createCampaign(tx, storeId, content))
    const id = c?.id as string
    await withStore(app, storeId, async (tx) => {
      await scheduleCampaign(tx, id)
      await startDueCampaigns(tx, storeId, TEST_SECRET)
      await unsubscribeCustomer(tx, a)
    })
    await withStore(app, storeId, (tx) => sendCampaignBatch(tx, storeId, deps, id))
    expect(sent.map((m) => (m.kind === 'email' ? m.to.email : ''))).toEqual(['b@x.in'])
    const [skipped] = await owner
      .select()
      .from(marketingMessage)
      .where(eq(marketingMessage.customerId, a))
    expect(skipped?.status).toBe('skipped')
  })

  it('sends WhatsApp broadcasts as the approved template with merge tags filled', async () => {
    const storeId = await newStore('g')
    await addCustomer(storeId, 'w@x.in', { acceptsWhatsapp: true, phone: '9876543210' })
    const { sent, deps } = recorder()
    const c = await withStore(app, storeId, (tx) =>
      createCampaign(tx, storeId, {
        ...content,
        kind: 'whatsapp',
        whatsapp: { name: 'diwali_sale', language: 'en', variables: ['{first_name}', '20%'] },
      }),
    )
    const id = c?.id as string
    await withStore(app, storeId, async (tx) => {
      await scheduleCampaign(tx, id)
      await startDueCampaigns(tx, storeId, TEST_SECRET)
      await sendCampaignBatch(tx, storeId, deps, id)
    })
    expect(sent).toEqual([
      {
        kind: 'whatsapp_template',
        to: { phone: '919876543210' },
        template: { name: 'diwali_sale', language: 'en', variables: ['Asha', '20%'] },
      },
    ])
  })

  it('keeps campaigns and messages inside their store', async () => {
    const a = await newStore('h1')
    const b = await newStore('h2')
    await addCustomer(a, 'a@x.in')
    const c = await withStore(app, a, (tx) => createCampaign(tx, a, content))
    await withStore(app, a, async (tx) => {
      await scheduleCampaign(tx, c?.id as string)
      await startDueCampaigns(tx, a, TEST_SECRET)
    })
    const fromB = await withStore(app, b, (tx) => tx.select().from(marketingMessage))
    expect(fromB).toEqual([])
    expect(await withStore(app, b, (tx) => startDueCampaigns(tx, b, TEST_SECRET))).toEqual([])
    const { deps } = recorder()
    expect(
      await withStore(app, b, (tx) => sendCampaignBatch(tx, b, deps, c?.id as string)),
    ).toEqual({ sent: 0, failed: 0, done: true })
  })
})

describe('tokens', () => {
  it('rejects forged or cross-store message tokens', () => {
    expect(verifyMessageToken('a.b.c', SECRET)).toBeNull()
    expect(verifyMessageToken('nope', SECRET)).toBeNull()
  })
})
