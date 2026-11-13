import { encryptNotificationSettings, parseNotificationSettings } from '@commerce/core'
import { createDb, notification, order, platformAccount, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import {
  type ChannelTemplateSpec,
  type ChannelTemplateStatus,
  type NotificationChannelFactory,
  NotificationRegistry,
} from '@commerce/notifications'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  submitWhatsappTemplates,
  whatsappMessages,
  whatsappSetup,
  whatsappTemplates,
} from '../src/services/whatsapp-setup.service'

/**
 * Apps → WhatsApp: Setup, Templates and Messages. Meta is never called: the WhatsApp channel is
 * a fake that records what it was asked (the real Graph calls are tested with a fake fetch in
 * @commerce/notifications-whatsapp).
 */
const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const secret = 'test-secret-test-secret-test-secret-1234'

type Fake = {
  statuses: ChannelTemplateStatus[]
  submitted: ChannelTemplateSpec[]
  configs: Record<string, string>[]
  failStatuses?: string
  failSubmit?: string
}

function fakeRegistry(fake: Fake) {
  const factory: NotificationChannelFactory<Record<string, string>> = {
    id: 'whatsapp',
    label: 'WhatsApp',
    fields: [],
    validateConfig: (raw) => {
      const r = (raw ?? {}) as Record<string, string>
      return r.phoneNumberId && r.accessToken
        ? { ok: true, config: r }
        : { ok: false, errors: ['missing'] }
    },
    create: (config) => {
      fake.configs.push(config)
      return {
        id: 'whatsapp',
        label: 'WhatsApp',
        requires: 'phone',
        send: async () => ({ ok: true, providerRef: 'x' }),
        templateStatuses: async () => {
          if (fake.failStatuses) throw new Error(fake.failStatuses)
          return fake.statuses
        },
        submitTemplate: async (spec) => {
          if (fake.failSubmit) throw new Error(fake.failSubmit)
          fake.submitted.push(spec)
          return { status: 'PENDING' }
        },
      }
    },
    templateSpecs: (ids, storeName) =>
      ids.map((id) => ({
        id,
        name: id,
        category: id === 'login_code' ? 'AUTHENTICATION' : 'UTILITY',
        body: `Hi {{1}}, ${id} from {{2}}.`,
        examples: ['Asha', storeName],
      })),
  }
  return new NotificationRegistry().register(factory)
}

const newFake = (): Fake => ({ statuses: [], submitted: [], configs: [] })

async function makeStore(slug: string, provider: Record<string, string> | null, enabled = true) {
  const notifications = encryptNotificationSettings(
    parseNotificationSettings({
      enabled: provider && enabled ? ['whatsapp'] : [],
      providers: provider ? { whatsapp: provider } : {},
    }),
    secret,
  )
  const [s] = await owner.insert(store).values({ slug, name: 'Waimers', notifications }).returning()
  return s?.id as string
}

const FULL = {
  phoneNumberId: '1234567890',
  accessToken: 'tok_secret',
  businessAccountId: '998877',
  templateLanguage: 'en',
}

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('whatsappSetup', () => {
  it('reads each step from the saved connection', async () => {
    const fake = newFake()
    const deps = { registry: fakeRegistry(fake), secret }
    const none = await makeStore('wa-none', null)
    const empty = await withStore(app, none, (tx) => whatsappSetup(tx, none, deps))
    expect(empty).toMatchObject({ number: null, connected: false, access: 'no_connection' })

    const manual = await makeStore('wa-manual', { phoneNumberId: '111', accessToken: 'tok' })
    const m = await withStore(app, manual, (tx) => whatsappSetup(tx, manual, deps))
    expect(m).toMatchObject({
      number: { label: null, verified: false },
      connected: true,
      via: 'manual',
      access: 'no_waba',
    })
    expect(m.previews.map((p) => p.text)).toEqual([
      'Hi Asha, order_placed from Waimers.',
      'Hi Asha, order_shipped from Waimers.',
    ])

    const signup = await makeStore('wa-signup', FULL)
    await owner.insert(platformAccount).values({
      storeId: signup,
      platform: 'whatsapp',
      externalId: '998877',
      status: 'active',
      detail: { displayPhone: '+91 98100 12345', verifiedName: 'Waimers', registered: 'yes' },
    })
    const s = await withStore(app, signup, (tx) => whatsappSetup(tx, signup, deps))
    expect(s).toMatchObject({
      number: { label: '+91 98100 •••••', verified: true },
      connected: true,
      via: 'signup',
      access: 'live',
    })
    // The decrypted token reached the channel, never the result.
    expect(fake.configs.at(-1)?.accessToken).toBe('tok_secret')
    expect(JSON.stringify(s)).not.toContain('tok_secret')
  })
})

describe('whatsappTemplates', () => {
  it("lists every WhatsApp message with Meta's status when the account ID is saved", async () => {
    const fake = newFake()
    fake.statuses = [
      { name: 'order_placed', language: 'en', status: 'APPROVED', category: 'UTILITY' },
      {
        name: 'order_shipped',
        language: 'en',
        status: 'REJECTED',
        category: 'UTILITY',
        rejectedReason: 'INVALID_FORMAT',
      },
      { name: 'delivered', language: 'en_US', status: 'PENDING', category: 'UTILITY' },
    ]
    const storeId = await makeStore('wa-templates', FULL)
    const r = await withStore(app, storeId, (tx) =>
      whatsappTemplates(tx, storeId, { registry: fakeRegistry(fake), secret }),
    )
    expect(r.access).toBe('live')
    expect(r.statusKnown).toBe(true)
    const by = Object.fromEntries(r.templates.map((t) => [t.id, t]))
    expect(by.order_placed?.status).toBe('approved')
    expect(by.order_shipped).toMatchObject({ status: 'rejected', rejectedReason: 'INVALID_FORMAT' })
    expect(by.delivered?.status).toBe('pending')
    expect(by.payment_received?.status).toBe('not_submitted')
    // Email-only messages are not WhatsApp templates; the sign-in code is.
    expect(by.gift_card_issued).toBeUndefined()
    expect(by.login_code?.category).toBe('AUTHENTICATION')
  })

  it("shows the list with Meta's error, and no status without the account ID", async () => {
    const fake = newFake()
    fake.failStatuses = 'Invalid OAuth access token.'
    const live = await makeStore('wa-err', FULL)
    const r = await withStore(app, live, (tx) =>
      whatsappTemplates(tx, live, { registry: fakeRegistry(fake), secret }),
    )
    expect(r).toMatchObject({ error: 'Invalid OAuth access token.', statusKnown: false })
    expect(r.templates.length).toBeGreaterThan(10)

    const manual = await makeStore('wa-nowaba', { phoneNumberId: '1', accessToken: 't' })
    const m = await withStore(app, manual, (tx) =>
      whatsappTemplates(tx, manual, { registry: fakeRegistry(newFake()), secret }),
    )
    expect(m).toMatchObject({ access: 'no_waba', statusKnown: false, error: null })
  })
})

describe('submitWhatsappTemplates', () => {
  it('submits what is missing and leaves templates already on the account', async () => {
    const fake = newFake()
    fake.statuses = [
      { name: 'order_placed', language: 'en', status: 'APPROVED', category: 'UTILITY' },
    ]
    const storeId = await makeStore('wa-submit', FULL)
    const r = await withStore(app, storeId, (tx) =>
      submitWhatsappTemplates(tx, storeId, ['order_placed', 'order_shipped', 'delivered'], {
        registry: fakeRegistry(fake),
        secret,
      }),
    )
    expect(r.access).toBe('live')
    expect(r.results).toEqual([
      { id: 'order_placed', ok: true, status: 'approved' },
      { id: 'order_shipped', ok: true, status: 'pending' },
      { id: 'delivered', ok: true, status: 'pending' },
    ])
    expect(fake.submitted.map((s) => s.id)).toEqual(['order_shipped', 'delivered'])
  })

  it("passes Meta's refusal on per message and submits nothing without access", async () => {
    const fake = newFake()
    fake.failSubmit = 'Template name already exists'
    const storeId = await makeStore('wa-refused', FULL)
    const r = await withStore(app, storeId, (tx) =>
      submitWhatsappTemplates(tx, storeId, ['delivered'], { registry: fakeRegistry(fake), secret }),
    )
    expect(r.results).toEqual([
      { id: 'delivered', ok: false, error: 'Template name already exists' },
    ])

    const none = newFake()
    const manual = await makeStore('wa-noaccess', { phoneNumberId: '1', accessToken: 't' })
    const m = await withStore(app, manual, (tx) =>
      submitWhatsappTemplates(tx, manual, ['delivered'], { registry: fakeRegistry(none), secret }),
    )
    expect(m).toEqual({ access: 'no_waba', results: [] })
    expect(none.submitted).toEqual([])
  })
})

describe('whatsappMessages', () => {
  it("lists only this store's WhatsApp sends, newest first, with the order number", async () => {
    const a = await makeStore('wa-log-a', FULL)
    const b = await makeStore('wa-log-b', FULL)
    const [o] = await owner
      .insert(order)
      .values({ storeId: a, number: 1042, status: 'open', subtotalPaise: 100, totalPaise: 100 })
      .returning()
    await owner.insert(notification).values([
      {
        storeId: a,
        orderId: o?.id,
        channel: 'whatsapp',
        template: 'order_placed',
        to: '919810012345',
        status: 'sent',
        providerRef: 'wamid.1',
        createdAt: new Date('2026-11-10T10:00:00Z'),
      },
      {
        storeId: a,
        orderId: o?.id,
        channel: 'whatsapp',
        template: 'order_shipped',
        to: '919810012345',
        status: 'failed',
        error: '(#132001) Template name does not exist in the translation',
        createdAt: new Date('2026-11-11T10:00:00Z'),
      },
      {
        storeId: a,
        orderId: o?.id,
        channel: 'ses',
        template: 'order_placed',
        to: 'a@b.in',
        status: 'sent',
      },
      { storeId: b, channel: 'whatsapp', template: 'delivered', to: '91999', status: 'sent' },
    ])
    const r = await withStore(app, a, (tx) => whatsappMessages(tx, {}))
    expect(r.next).toBeNull()
    expect(r.rows.map((x) => [x.template, x.status, x.orderNumber])).toEqual([
      ['order_shipped', 'failed', 1042],
      ['order_placed', 'sent', 1042],
    ])
    expect(r.rows[0]?.error).toContain('132001')
    const failed = await withStore(app, a, (tx) => whatsappMessages(tx, { status: 'sent' }))
    expect(failed.rows).toHaveLength(1)
  })
})
