/** SOURCE OF TRUTH: sender email lifecycle tests — WHAT: identity lifecycle, domain claims, platform From/Reply-To with SES mocked / WHY: one store never sends as another store's domain */
import { createDb, senderEmail, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type {
  MarketingSend,
  Message,
  NotificationChannel,
  SendResult,
} from '@commerce/notifications'
import type {
  SenderIdentityProvider,
  SenderIdentityState,
  SenderIdentityStatus,
} from '@commerce/notifications-ses'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { builtInNotificationRegistry } from '../notifications/settings'
import { storeNotificationChannels } from './channels'
import type { ChosenSender } from './client'
import { createDevSenderIdentityProvider } from './dev-provider'
import type { PlatformEmail } from './platform'
import {
  checkSenderEmail,
  getSenderEmail,
  pollSenderEmails,
  removeSenderEmail,
  SenderEmailError,
  senderEmailView,
  setSenderEmail,
} from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** A mocked SES: records every call, answers with whatever status the test sets per domain. */
function fakeIdentities() {
  const calls: string[] = []
  const status = new Map<string, SenderIdentityStatus>()
  const exists = new Set<string>()
  let generation = 0
  const state = (domain: string): SenderIdentityState => {
    const s = status.get(domain) ?? 'pending'
    return {
      status: s,
      dkimTokens: [
        `${domain}-g${generation}-a`,
        `${domain}-g${generation}-b`,
        `${domain}-g${generation}-c`,
      ],
      dkimHostedZone: 'dkim.amazonses.com',
      mailFrom: { domain: `bounce.${domain}`, status: s },
      error: s === 'failed' ? 'records_not_found' : null,
    }
  }
  const provider: SenderIdentityProvider = {
    id: 'ses',
    region: 'ap-south-1',
    async create(domain) {
      calls.push(`create ${domain}`)
      generation += 1
      exists.add(domain)
      return state(domain)
    },
    async get(domain) {
      calls.push(`get ${domain}`)
      return exists.has(domain) ? state(domain) : null
    },
    async setMailFrom(domain) {
      calls.push(`mailfrom ${domain}`)
      return true
    },
    async remove(domain) {
      calls.push(`remove ${domain}`)
      exists.delete(domain)
      status.delete(domain)
    },
  }
  return { provider, calls, status }
}

const reserved = ['localhost', 'mail.platform.test']

async function seedStore(slug: string, extra: Partial<typeof store.$inferInsert> = {}) {
  const [s] = await owner
    .insert(store)
    .values({ slug, name: `Shop ${slug}`, ...extra })
    .returning()
  if (!s) throw new Error('seed')
  return s.id
}

const inStore = <T>(storeId: string, fn: Parameters<typeof withStore<T>>[2]) =>
  withStore(app, storeId, fn)

describe('sender email lifecycle', () => {
  it('claims a domain as pending, verifies it on check, and shows the DNS records', async () => {
    const ses = fakeIdentities()
    const deps = { identities: ses.provider, reservedDomains: reserved }
    const storeId = await seedStore('a')

    const row = await inStore(storeId, (tx) =>
      setSenderEmail(tx, storeId, { email: 'Support@Waimers.in', displayName: 'Waimers' }, deps),
    )
    expect(row).toMatchObject({
      email: 'support@waimers.in',
      domain: 'waimers.in',
      displayName: 'Waimers',
      status: 'pending',
      provider: 'ses',
      mailFromDomain: 'bounce.waimers.in',
      verifiedAt: null,
    })
    expect(ses.calls).toEqual(['create waimers.in'])
    const view = senderEmailView(row, 'ap-south-1')
    expect(view.records.map((r) => r.type)).toEqual(['CNAME', 'CNAME', 'CNAME', 'MX', 'TXT', 'TXT'])
    expect(view).not.toHaveProperty('storeId')

    ses.status.set('waimers.in', 'verified')
    const checked = await inStore(storeId, (tx) => checkSenderEmail(tx, storeId, deps))
    expect(checked?.row).toMatchObject({ status: 'verified', error: null })
    expect(checked?.row.verifiedAt).toBeInstanceOf(Date)
    expect(checked?.restarted).toBe(false)
  })

  it('records a failure with its reason and restarts it with fresh records on Check now', async () => {
    const ses = fakeIdentities()
    const deps = { identities: ses.provider, reservedDomains: reserved }
    const storeId = await seedStore('a')
    const first = await inStore(storeId, (tx) =>
      setSenderEmail(tx, storeId, { email: 'hi@shop.in' }, deps),
    )
    ses.status.set('shop.in', 'failed')
    const polled = await inStore(storeId, (tx) => checkSenderEmail(tx, storeId, deps))
    expect(polled?.row).toMatchObject({ status: 'failed', error: 'records_not_found' })

    const restarted = await inStore(storeId, (tx) =>
      checkSenderEmail(tx, storeId, { ...deps, restartFailed: true }),
    )
    expect(restarted?.restarted).toBe(true)
    expect(restarted?.row.status).toBe('pending')
    expect(restarted?.row.dkimTokens).not.toEqual(first.dkimTokens)
    expect(ses.calls).toContain('remove shop.in')
  })

  it('keeps the identity when only the part before @ changes, re-verifies a new domain', async () => {
    const ses = fakeIdentities()
    const deps = { identities: ses.provider, reservedDomains: reserved }
    const storeId = await seedStore('a')
    await inStore(storeId, (tx) => setSenderEmail(tx, storeId, { email: 'a@one.in' }, deps))
    ses.status.set('one.in', 'verified')
    const same = await inStore(storeId, (tx) =>
      setSenderEmail(tx, storeId, { email: 'orders@one.in' }, deps),
    )
    expect(same).toMatchObject({ email: 'orders@one.in', status: 'verified' })
    expect(ses.calls).toEqual(['create one.in', 'get one.in'])

    const moved = await inStore(storeId, (tx) =>
      setSenderEmail(tx, storeId, { email: 'hi@two.in' }, deps),
    )
    expect(moved).toMatchObject({ domain: 'two.in', status: 'pending', verifiedAt: null })
    expect(ses.calls.slice(-2)).toEqual(['create two.in', 'remove one.in'])
    const rows = await owner.select().from(senderEmail)
    expect(rows).toHaveLength(1)
  })

  it('refuses free mail and platform addresses before touching SES', async () => {
    const ses = fakeIdentities()
    const deps = { identities: ses.provider, reservedDomains: reserved }
    const storeId = await seedStore('a')
    for (const [email, reason] of [
      ['me@gmail.com', 'free_mail'],
      ['x@mail.platform.test', 'platform_domain'],
      ['not-an-email', 'invalid'],
    ] as const) {
      await expect(
        inStore(storeId, (tx) => setSenderEmail(tx, storeId, { email }, deps)),
      ).rejects.toMatchObject({ reason })
    }
    expect(ses.calls).toEqual([])
  })

  it('removes the address and its identity', async () => {
    const ses = fakeIdentities()
    const deps = { identities: ses.provider, reservedDomains: reserved }
    const storeId = await seedStore('a')
    await inStore(storeId, (tx) => setSenderEmail(tx, storeId, { email: 'a@one.in' }, deps))
    expect(await inStore(storeId, (tx) => removeSenderEmail(tx, deps))).toBe(true)
    expect(await inStore(storeId, (tx) => getSenderEmail(tx))).toBeNull()
    expect(ses.calls.at(-1)).toBe('remove one.in')
    expect(await inStore(storeId, (tx) => removeSenderEmail(tx, deps))).toBe(false)
  })
})

describe('domain claims across stores', () => {
  it.each([
    ['the same domain', 'waimers.in', 'b@waimers.in'],
    ['a subdomain of it', 'waimers.in', 'b@shop.waimers.in'],
    ['its parent', 'shop.waimers.in', 'b@waimers.in'],
  ])('refuses %s held by another store, without creating an identity', async (_, first, email) => {
    const ses = fakeIdentities()
    const deps = { identities: ses.provider, reservedDomains: reserved }
    const a = await seedStore('a')
    const b = await seedStore('b')
    await inStore(a, (tx) => setSenderEmail(tx, a, { email: `a@${first}` }, deps))
    const err = await inStore(b, (tx) => setSenderEmail(tx, b, { email }, deps)).catch((e) => e)
    expect(err).toBeInstanceOf(SenderEmailError)
    expect(err.reason).toBe('domain_taken')
    // The refusal says nothing about which store holds it.
    expect(err.message).not.toContain(a)
    expect(ses.calls).toEqual([`create ${first}`])
  })

  it('lets a store see only its own sender row (RLS)', async () => {
    const deps = { identities: fakeIdentities().provider, reservedDomains: reserved }
    const a = await seedStore('a')
    const b = await seedStore('b')
    await inStore(a, (tx) => setSenderEmail(tx, a, { email: 'a@one.in' }, deps))
    expect(await inStore(b, (tx) => getSenderEmail(tx))).toBeNull()
  })
})

describe('pollSenderEmails', () => {
  it('checks pending senders across stores and skips recently checked verified ones', async () => {
    const identities = createDevSenderIdentityProvider()
    const deps = { identities, reservedDomains: reserved }
    const a = await seedStore('a')
    const b = await seedStore('b')
    await inStore(a, (tx) => setSenderEmail(tx, a, { email: 'a@brand.test' }, deps))
    await inStore(b, (tx) => setSenderEmail(tx, b, { email: 'b@real-shop.in' }, deps))

    expect(await pollSenderEmails(app, deps)).toEqual({ checked: 2, verified: 1, failed: 0 })
    // brand.test is verified and was just checked; only real-shop.in is still pending.
    expect(await pollSenderEmails(app, deps)).toEqual({ checked: 1, verified: 0, failed: 0 })
  })
})

/** A channel that records what it was built with and what it sent. */
class RecordingChannel implements NotificationChannel {
  readonly id = 'platform_email'
  readonly label = 'Platform'
  readonly requires = 'email' as const
  readonly sent: Message[] = []
  constructor(readonly sender: ChosenSender) {}
  async send(message: Message): Promise<SendResult> {
    this.sent.push(message)
    return { ok: true, providerRef: 'r' }
  }
  async sendMarketing(_: MarketingSend): Promise<SendResult> {
    return { ok: true, providerRef: 'm' }
  }
}

describe('storeNotificationChannels', () => {
  const platform = (): PlatformEmail => ({
    fromEmail: 'no-reply@mail.platform.test',
    fromName: 'Waimers',
    identities: fakeIdentities().provider,
    reservedDomains: reserved,
    transport: {
      fromEmail: 'no-reply@mail.platform.test',
      fromName: 'Waimers',
      channel: (sender) => new RecordingChannel(sender),
    },
  })
  const registry = builtInNotificationRegistry()

  it('sends from the platform with Reply-To the shop before verification, from the shop after', async () => {
    const ses = fakeIdentities()
    const deps = { identities: ses.provider, reservedDomains: reserved }
    const storeId = await seedStore('a', { contactEmail: 'owner@gmail.com' })
    const channelsNow = () =>
      inStore(storeId, (tx) =>
        storeNotificationChannels(tx, storeId, {
          registry,
          settingsSecret: 'test-secret-1234567890',
          platform: platform(),
        }),
      )

    const [none] = (await channelsNow()) as RecordingChannel[]
    expect(none?.sender).toMatchObject({
      fromEmail: 'no-reply@mail.platform.test',
      replyTo: 'owner@gmail.com',
      using: 'platform',
    })

    await inStore(storeId, (tx) =>
      setSenderEmail(tx, storeId, { email: 'support@waimers.in' }, deps),
    )
    const [pending] = (await channelsNow()) as RecordingChannel[]
    expect(pending?.sender).toEqual({
      fromName: 'Shop a',
      fromEmail: 'no-reply@mail.platform.test',
      replyTo: 'support@waimers.in',
      using: 'platform',
    })

    ses.status.set('waimers.in', 'verified')
    await inStore(storeId, (tx) => checkSenderEmail(tx, storeId, deps))
    const [verified] = (await channelsNow()) as RecordingChannel[]
    expect(verified?.sender).toEqual({
      fromName: 'Shop a',
      fromEmail: 'support@waimers.in',
      replyTo: undefined,
      using: 'own',
    })
  })

  it('leaves the platform sender out when the store connected its own Amazon SES app', async () => {
    const storeId = await seedStore('a', {
      notifications: {
        enabled: ['ses'],
        providers: {
          ses: {
            region: 'ap-south-1',
            accessKeyId: 'AKIAOFFLINE',
            secretAccessKey: 'offline',
            fromEmail: 'orders@own.in',
          },
        },
      },
    })
    const sesRegistry = builtInNotificationRegistry().register({
      id: 'ses',
      label: 'SES',
      fields: [],
      validateConfig: (raw) => ({ ok: true, config: raw }),
      create: () => ({
        id: 'ses',
        label: 'SES',
        requires: 'email' as const,
        send: async () => ({ ok: true as const, providerRef: 'own' }),
      }),
    })
    const channels = await inStore(storeId, (tx) =>
      storeNotificationChannels(tx, storeId, {
        registry: sesRegistry,
        settingsSecret: 'test-secret-1234567890',
        platform: platform(),
      }),
    )
    expect(channels.map((c) => c.id)).toEqual(['ses'])
  })

  it('adds nothing when the platform account is not configured (development)', async () => {
    const storeId = await seedStore('a')
    const channels = await inStore(storeId, (tx) =>
      storeNotificationChannels(tx, storeId, {
        registry,
        settingsSecret: 'test-secret-1234567890',
        platform: { ...platform(), transport: null },
      }),
    )
    expect(channels).toEqual([])
  })
})
