import {
  createDb,
  customer,
  newsletterSignup,
  notification,
  outboxEvent,
  type StoreTx,
  store,
  storeDomain,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { NotificationChannel } from '@commerce/notifications'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { deliverNewsletterConfirm } from '../notifications/deliver'
import {
  confirmNewsletterSignup,
  newsletterConfirmToken,
  newsletterSignupForToken,
  requestNewsletterSignup,
} from './newsletter'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-only-settings-secret-value'
const NOW = new Date('2026-10-01T10:00:00Z')

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

async function makeStore(slug = 'nl'): Promise<string> {
  const [s] = await owner.insert(store).values({ slug, name: 'NL Store' }).returning()
  return s?.id as string
}

/** A test email channel that records what it would send; nothing leaves the machine. */
function fakeEmail() {
  const sent: { to: string | undefined; template: string; actionUrl: string | undefined }[] = []
  const channel = {
    id: 'fake-email',
    requires: 'email',
    send: async (m: { to: { email?: string }; template: string; data: { actionUrl?: string } }) => {
      sent.push({ to: m.to.email, template: m.template, actionUrl: m.data.actionUrl })
      return { ok: true, providerRef: `fake-${sent.length}` }
    },
  } as unknown as NotificationChannel
  return { sent, channel }
}

const tokenFor = async (_storeId: string, email: string) => {
  const [row] = await owner.select().from(newsletterSignup)
  if (!row || row.email !== email) throw new Error('no signup')
  return newsletterConfirmToken(row, SECRET)
}

describe('newsletter double opt-in (D-09)', () => {
  it('a signup records nothing on a customer and queues one confirm email through the outbox', async () => {
    const storeId = await makeStore()
    expect(
      await inStore(storeId, (tx) =>
        requestNewsletterSignup(tx, storeId, ' Asha@Example.com ', NOW),
      ),
    ).toBe('sent')
    expect(await owner.select().from(customer)).toHaveLength(0)
    const [signup] = await owner.select().from(newsletterSignup)
    expect(signup).toMatchObject({ email: 'asha@example.com', status: 'pending' })
    const events = await owner.select().from(outboxEvent)
    expect(events.map((e) => [e.type, e.payload])).toEqual([
      ['newsletter.confirm_requested', { signupId: signup?.id }],
    ])
    // Pressing Subscribe again at once sends nothing more.
    expect(
      await inStore(storeId, (tx) => requestNewsletterSignup(tx, storeId, 'asha@example.com', NOW)),
    ).toBe('already_sent')
    expect(await owner.select().from(outboxEvent)).toHaveLength(1)
    expect(await inStore(storeId, (tx) => requestNewsletterSignup(tx, storeId, 'nope', NOW))).toBe(
      'invalid',
    )
  })

  it('sends the confirm link to the store’s own domain, email only, and skips confirmed signups', async () => {
    const storeId = await makeStore()
    await owner
      .insert(storeDomain)
      .values({ storeId, hostname: 'shop.example.in', isPrimary: true, status: 'active' })
    await inStore(storeId, (tx) => requestNewsletterSignup(tx, storeId, 'asha@example.com', NOW))
    const [signup] = await owner.select().from(newsletterSignup)
    const { sent, channel } = fakeEmail()
    const deliver = () =>
      inStore(storeId, (tx) =>
        deliverNewsletterConfirm(
          { storeId, tx },
          { signupId: signup?.id as string },
          {
            registry: {} as never,
            settingsSecret: SECRET,
            storefrontUrl: 'https://waimers.store',
            channels: [channel],
          },
          NOW,
        ),
      )
    expect(await deliver()).toEqual([{ channel: 'fake-email', to: 'asha@example.com', ok: true }])
    expect(sent[0]?.template).toBe('newsletter_confirm')
    expect(sent[0]?.actionUrl).toMatch(/^https:\/\/shop\.example\.in\/newsletter\/confirm\//)
    expect(await owner.select().from(notification)).toHaveLength(1)
    await owner.update(newsletterSignup).set({ status: 'confirmed' })
    expect(await deliver()).toEqual([])
  })

  it('consent starts only when the link is confirmed, once', async () => {
    const storeId = await makeStore()
    await owner
      .insert(customer)
      .values({ storeId, email: 'asha@example.com', name: 'Asha', tags: ['vip'] })
    await inStore(storeId, (tx) => requestNewsletterSignup(tx, storeId, 'asha@example.com', NOW))
    const [before] = await owner.select().from(customer)
    expect(before?.acceptsMarketing).toBe(false)

    const token = await tokenFor(storeId, 'asha@example.com')
    expect(
      await inStore(storeId, (tx) => newsletterSignupForToken(tx, storeId, token, SECRET, NOW)),
    ).toMatchObject({ email: 'asha@example.com', status: 'pending' })
    const first = await inStore(storeId, (tx) =>
      confirmNewsletterSignup(tx, storeId, token, SECRET, NOW),
    )
    expect(first).toMatchObject({ ok: true, alreadyConfirmed: false, email: 'asha@example.com' })
    const again = await inStore(storeId, (tx) =>
      confirmNewsletterSignup(tx, storeId, token, SECRET, NOW),
    )
    expect(again).toMatchObject({ ok: true, alreadyConfirmed: true })
    const [after] = await owner.select().from(customer)
    expect(after).toMatchObject({
      name: 'Asha',
      acceptsMarketing: true,
      marketingConsentSource: 'newsletter',
      tags: ['vip', 'newsletter'],
    })
  })

  it('refuses a token from another store, a tampered token and an expired one', async () => {
    const storeId = await makeStore('a')
    const other = await makeStore('b')
    await inStore(storeId, (tx) => requestNewsletterSignup(tx, storeId, 'asha@example.com', NOW))
    const token = await tokenFor(storeId, 'asha@example.com')
    expect(
      await inStore(other, (tx) => confirmNewsletterSignup(tx, other, token, SECRET, NOW)),
    ).toEqual({ ok: false })
    expect(
      await inStore(storeId, (tx) =>
        confirmNewsletterSignup(tx, storeId, `${token}x`, SECRET, NOW),
      ),
    ).toEqual({ ok: false })
    const late = new Date(NOW.getTime() + 8 * 24 * 60 * 60 * 1000)
    expect(
      await inStore(storeId, (tx) => confirmNewsletterSignup(tx, storeId, token, SECRET, late)),
    ).toEqual({ ok: false })
    expect(await owner.select().from(customer)).toHaveLength(0)
  })

  it('a confirmed signup after an unsubscribe is a fresh opt in', async () => {
    const storeId = await makeStore()
    await owner.insert(customer).values({
      storeId,
      email: 'gone@example.com',
      acceptsMarketing: false,
      unsubscribedAt: new Date('2026-01-01'),
    })
    await inStore(storeId, (tx) => requestNewsletterSignup(tx, storeId, 'gone@example.com', NOW))
    const token = await tokenFor(storeId, 'gone@example.com')
    await inStore(storeId, (tx) => confirmNewsletterSignup(tx, storeId, token, SECRET, NOW))
    const [c] = await owner.select().from(customer)
    expect(c).toMatchObject({
      acceptsMarketing: true,
      marketingConsentSource: 'newsletter',
      unsubscribedAt: null,
    })
    expect(c?.marketingConsentAt).toBeInstanceOf(Date)
  })
})
