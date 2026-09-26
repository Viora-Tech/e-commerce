import {
  builtInNotificationRegistry,
  encryptNotificationSettings,
  parseNotificationSettings,
} from '@commerce/core'
import { createDb, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  notificationsOverview,
  previewMessage,
  sendTestMessage,
  setMessageOn,
} from '../src/services/notifications.service'
import { settingsChecklist } from '../src/services/settings-home.service'

/**
 * Settings → Notifications and the Settings home checklist. Only the test DB
 * is touched; the "send a test" path uses the built-in log channel, which
 * prints instead of sending.
 */
const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const secret = 'test-secret-test-secret-test-secret-1234'
const registry = builtInNotificationRegistry()

async function makeStore(slug: string, values: Partial<typeof store.$inferInsert> = {}) {
  const [s] = await owner
    .insert(store)
    .values({ slug, name: 'Waimers', ...values })
    .returning()
  return s?.id as string
}

async function savedSettings(storeId: string) {
  const [row] = await owner
    .select({ notifications: store.notifications })
    .from(store)
    .where(eq(store.id, storeId))
  return parseNotificationSettings(row?.notifications)
}

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('notificationsOverview', () => {
  it('starts with every message on and no way to send', async () => {
    const storeId = await makeStore('n-overview')
    const r = await withStore(app, storeId, (tx) => notificationsOverview(tx, storeId))
    expect(r.messages.every((m) => m.on)).toBe(true)
    expect(r.messages.find((m) => m.id === 'login_code')?.switchable).toBe(false)
    expect(r.channels.email.state).toBe('missing')
    expect(r.channels.whatsapp.state).toBe('missing')
    expect(r.canSendTest).toBe(false)
  })

  it('reports an installed and switched-on email app as connected', async () => {
    const storeId = await makeStore('n-connected', {
      apps: { installed: ['ses', 'whatsapp'] },
      notifications: { enabled: ['ses'], providers: {} },
    })
    const r = await withStore(app, storeId, (tx) => notificationsOverview(tx, storeId))
    expect(r.channels.email.state).toBe('connected')
    expect(r.channels.whatsapp.state).toBe('installed')
    expect(r.canSendTest).toBe(true)
  })
})

describe('setMessageOn', () => {
  it('switches automatic messages off and on, keeping stored credentials untouched', async () => {
    const enc = encryptNotificationSettings(
      parseNotificationSettings({
        enabled: ['log'],
        providers: { whatsapp: { phoneNumberId: '1', accessToken: 'tok_secret' } },
      }),
      secret,
    )
    const storeId = await makeStore('n-toggle', { notifications: enc })
    await withStore(app, storeId, (tx) => setMessageOn(tx, storeId, 'order_shipped', false))
    let s = await savedSettings(storeId)
    expect(s.off).toEqual(['order_shipped'])
    expect(s.providers.whatsapp?.accessToken).toBe(enc.providers.whatsapp?.accessToken)
    expect(s.enabled).toEqual(['log'])

    // A message the shop needs cannot be switched off.
    await withStore(app, storeId, (tx) => setMessageOn(tx, storeId, 'login_code', false))
    expect((await savedSettings(storeId)).off).toEqual(['order_shipped'])

    await withStore(app, storeId, (tx) => setMessageOn(tx, storeId, 'order_shipped', true))
    s = await savedSettings(storeId)
    expect(s.off).toEqual([])
  })
})

describe('previewMessage', () => {
  it('renders the email and WhatsApp text with the store name and a sample order', async () => {
    const storeId = await makeStore('n-preview', { name: 'Chai Corner' })
    const r = await withStore(app, storeId, (tx) => previewMessage(tx, storeId, 'order_placed'))
    expect(r.subject).toContain('Chai Corner')
    expect(r.html).toContain('Chai Corner')
    expect(r.whatsapp).toBeTruthy()
    const giftCard = await withStore(app, storeId, (tx) =>
      previewMessage(tx, storeId, 'gift_card_issued'),
    )
    expect(giftCard.whatsapp).toBeNull()
  })
})

describe('sendTestMessage', () => {
  it('explains when there is no email channel', async () => {
    const storeId = await makeStore('n-test-none')
    const r = await withStore(app, storeId, (tx) =>
      sendTestMessage(tx, storeId, {
        template: 'order_placed',
        to: 'owner@example.com',
        registry,
        secret,
        previousSecrets: [],
      }),
    )
    expect(r).toEqual({ ok: false, sent: 0, error: 'no_channel' })
  })

  it('sends the sample message only to the given address', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const storeId = await makeStore('n-test-log', {
      notifications: { enabled: ['log'], providers: {} },
    })
    const r = await withStore(app, storeId, (tx) =>
      sendTestMessage(tx, storeId, {
        template: 'order_shipped',
        to: 'owner@example.com',
        registry,
        secret,
        previousSecrets: [],
      }),
    )
    expect(r).toMatchObject({ ok: true, sent: 1 })
    log.mockRestore()
  })
})

describe('settingsChecklist', () => {
  it('ticks items from real data', async () => {
    const storeId = await makeStore('n-checklist', {
      contactEmail: 'shop@example.com',
      address: { line1: '1 MG Road', city: 'Bengaluru', pincode: '560001' },
      gstin: '29ABCDE1234F1Z5',
      payments: { enabled: ['cod'], providers: {} },
      notifications: { enabled: ['ses'], providers: {} },
    })
    const items = await withStore(app, storeId, (tx) => settingsChecklist(tx, storeId))
    const done = Object.fromEntries(items.map((i) => [i.id, i.done]))
    expect(done).toEqual({
      store: true,
      payments: true,
      shipping: false,
      taxes: true,
      domain: false,
      notifications: true,
      policies: false,
    })
  })

  it('leaves everything but payments to do on a new store (cash on delivery starts on)', async () => {
    const storeId = await makeStore('n-checklist-new')
    const items = await withStore(app, storeId, (tx) => settingsChecklist(tx, storeId))
    expect(items.filter((i) => i.done).map((i) => i.id)).toEqual(['payments'])
    expect(items).toHaveLength(7)
  })
})
