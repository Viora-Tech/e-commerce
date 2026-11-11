/** SOURCE OF TRUTH: email suppression tests — WHAT: hard bounce, soft bounces in a window, complaints, redelivered SNS messages, Allow again, store lookup by tag or domain, RLS between stores, and store sends skipping suppressed addresses / WHY: a bounced or complaining address must stop getting mail from that store only, and come back only when staff say so */
import {
  createDb,
  emailFeedbackEvent,
  emailSuppression,
  senderEmail,
  store,
  storeForEmailFeedback,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { Message, NotificationChannel } from '@commerce/notifications'
import { sampleTemplateDataByTemplate } from '@commerce/notifications'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { builtInNotificationRegistry } from '../notifications/settings'
import { storeNotificationChannels } from '../sender-email/channels'
import type { PlatformEmail } from '../sender-email/platform'
import {
  activeSuppressions,
  allowEmailAgain,
  emailSuppressionFor,
  listEmailSuppressions,
  recordEmailFeedback,
  SOFT_BOUNCE_LIMIT,
} from './service'
import type { SesFeedback } from './ses-feedback'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedStore(slug: string) {
  const [s] = await owner
    .insert(store)
    .values({ slug, name: `Shop ${slug}` })
    .returning()
  if (!s) throw new Error('seed')
  return s.id
}

const feedback = (over: Partial<SesFeedback> = {}): SesFeedback => ({
  kind: 'bounce',
  bounceType: 'Permanent',
  subType: 'General',
  recipients: [{ email: 'Asha@Example.com', detail: 'smtp; 550 user unknown' }],
  sesMessageId: 'ses-1',
  storeTag: null,
  fromDomain: null,
  ...over,
})

const soft = feedback({ bounceType: 'Transient', subType: 'MailboxFull' })
const day = (n: number) => new Date(Date.UTC(2026, 10, n, 6))

describe('recordEmailFeedback', () => {
  it('suppresses a hard bounce at once, lower case, and only for that store', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    const r = await withStore(app, a, (tx) => recordEmailFeedback(tx, a, 'sns-1', feedback()))
    expect(r).toEqual({ recorded: 1, suppressed: ['asha@example.com'] })
    const row = await withStore(app, a, (tx) => emailSuppressionFor(tx, 'ASHA@example.com '))
    expect(row).toMatchObject({ reason: 'hard_bounce', detail: 'smtp; 550 user unknown' })
    // RLS: the other store still mails the address and sees no list.
    expect(await withStore(app, b, (tx) => emailSuppressionFor(tx, 'asha@example.com'))).toBeNull()
    expect(await withStore(app, b, (tx) => listEmailSuppressions(tx))).toEqual([])
  })

  it('suppresses a complaint at once', async () => {
    const a = await seedStore('a')
    await withStore(app, a, (tx) =>
      recordEmailFeedback(
        tx,
        a,
        'sns-c',
        feedback({ kind: 'complaint', bounceType: null, subType: 'abuse' }),
      ),
    )
    expect(
      await withStore(app, a, (tx) => emailSuppressionFor(tx, 'asha@example.com')),
    ).toMatchObject({ reason: 'complaint' })
  })

  it('counts a redelivered SNS message once', async () => {
    const a = await seedStore('a')
    for (let i = 0; i < SOFT_BOUNCE_LIMIT + 2; i++) {
      await withStore(app, a, (tx) => recordEmailFeedback(tx, a, 'sns-same', soft, day(1)))
    }
    expect(await owner.select().from(emailFeedbackEvent)).toHaveLength(1)
    expect(await owner.select().from(emailSuppression)).toHaveLength(0)
  })

  it('suppresses after the soft-bounce limit inside the window, not across it', async () => {
    const a = await seedStore('a')
    // Two old soft bounces fall out of the 14-day window before the next ones.
    await withStore(app, a, (tx) => recordEmailFeedback(tx, a, 'old-1', soft, day(1)))
    await withStore(app, a, (tx) => recordEmailFeedback(tx, a, 'old-2', soft, day(2)))
    const r1 = await withStore(app, a, (tx) => recordEmailFeedback(tx, a, 'new-1', soft, day(20)))
    const r2 = await withStore(app, a, (tx) => recordEmailFeedback(tx, a, 'new-2', soft, day(21)))
    expect([r1.suppressed, r2.suppressed]).toEqual([[], []])
    const r3 = await withStore(app, a, (tx) => recordEmailFeedback(tx, a, 'new-3', soft, day(22)))
    expect(r3.suppressed).toEqual(['asha@example.com'])
    expect(
      await withStore(app, a, (tx) => emailSuppressionFor(tx, 'asha@example.com')),
    ).toMatchObject({ reason: 'soft_bounces' })
  })

  it('Allow again clears it, and only feedback after that counts', async () => {
    const a = await seedStore('a')
    for (const [i, d] of [1, 2, 3].entries()) {
      await withStore(app, a, (tx) => recordEmailFeedback(tx, a, `s-${i}`, soft, day(d)))
    }
    expect(
      await withStore(app, a, (tx) =>
        allowEmailAgain(tx, 'ASHA@example.com', 'staff@shop.example', day(4)),
      ),
    ).toBe(true)
    expect(await withStore(app, a, (tx) => emailSuppressionFor(tx, 'asha@example.com'))).toBeNull()
    expect(
      await withStore(app, a, (tx) => allowEmailAgain(tx, 'asha@example.com', 'x', day(4))),
    ).toBe(false)
    // One more soft bounce is not three since Allow again.
    const r = await withStore(app, a, (tx) => recordEmailFeedback(tx, a, 's-4', soft, day(5)))
    expect(r.suppressed).toEqual([])
    // A hard bounce suppresses again.
    const hard = await withStore(app, a, (tx) =>
      recordEmailFeedback(tx, a, 'h-1', feedback(), day(6)),
    )
    expect(hard.suppressed).toEqual(['asha@example.com'])
    const [row] = await owner.select().from(emailSuppression)
    expect(row).toMatchObject({ reason: 'hard_bounce', clearedAt: null, clearedBy: null })
  })
})

describe('storeForEmailFeedback', () => {
  it('finds the store by its tag when it exists, else by its sender domain', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    await owner.insert(senderEmail).values({
      storeId: b,
      email: 'hello@shop.example',
      domain: 'shop.example',
      provider: 'ses',
    })
    expect(await storeForEmailFeedback(app, { storeTag: a, fromDomain: 'shop.example' })).toBe(a)
    expect(
      await storeForEmailFeedback(app, {
        storeTag: '00000000-0000-4000-8000-000000000000',
        fromDomain: 'SHOP.example',
      }),
    ).toBe(b)
    expect(
      await storeForEmailFeedback(app, { storeTag: null, fromDomain: 'other.example' }),
    ).toBeNull()
  })
})

describe('store sends skip suppressed addresses', () => {
  it('builds the store channels with the guard: suppressed recipients never reach the provider', async () => {
    const a = await seedStore('a')
    await withStore(app, a, (tx) => recordEmailFeedback(tx, a, 'sns-1', feedback()))
    const reached: string[] = []
    const provider: NotificationChannel = {
      id: 'platform_email',
      label: 'Platform',
      requires: 'email',
      async send(m: Message) {
        reached.push(m.to.email ?? '')
        return { ok: true, providerRef: 'p' }
      },
    }
    const platform = {
      fromEmail: 'no-reply@mail.platform.test',
      fromName: 'Platform',
      identities: {} as PlatformEmail['identities'],
      reservedDomains: [],
      transport: {
        fromEmail: 'no-reply@mail.platform.test',
        fromName: 'Platform',
        channel: () => provider,
      },
    } satisfies PlatformEmail
    const results = await withStore(app, a, async (tx) => {
      expect([...(await activeSuppressions(tx)).keys()]).toEqual(['asha@example.com'])
      const channels = await storeNotificationChannels(tx, a, {
        registry: builtInNotificationRegistry(),
        settingsSecret: 'secret-secret-secret-secret',
        platform,
      })
      const email = channels.find((c) => c.requires === 'email')
      if (!email) throw new Error('no email channel')
      const message = (to: string): Message => ({
        to: { email: to },
        template: 'order_placed',
        data: sampleTemplateDataByTemplate.order_placed,
      })
      return [
        await email.send(message('asha@example.com')),
        await email.send(message('ok@example.com')),
      ]
    })
    expect(results[0]).toMatchObject({ ok: false })
    expect(results[0]?.ok ? '' : results[0]?.error).toMatch(/^suppressed: hard_bounce/)
    expect(results[1]).toMatchObject({ ok: true })
    expect(reached).toEqual(['ok@example.com'])
  })
})
