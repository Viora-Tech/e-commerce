/** SOURCE OF TRUTH: weekly and monthly report send tests — WHAT: who gets the weekly report, when, once, and the figures it carries from real rows / WHY: it reads order and session tables the way Analytics does; a cancelled order counted here would contradict the Analytics page */
import {
  authSchema,
  createDb,
  customer,
  marketingSession,
  order,
  store,
  storeMember,
  storesWithMemberReports,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { Message, NotificationChannel } from '@commerce/notifications'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { builtInNotificationRegistry } from '../notifications/settings'
import { listRoles, saveRole, seedSystemRoles, upsertMember } from '../permissions/service'
import { type MemberAlertPrefs, parseMemberAlertPrefs } from './alert-prefs'
import { sendDueReports } from './reports'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const registry = builtInNotificationRegistry()

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const ist = (wall: string) => new Date(`${wall}:00.000+05:30`)

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

/** A store whose staff and packer asked for the weekly report; the packer cannot see orders. */
async function seed() {
  const [s] = await owner.insert(store).values({ slug: 'r', name: 'Test Shop' }).returning()
  if (!s) throw new Error('seed')
  const storeId = s.id
  const users = [
    { id: 'u-owner', email: 'owner@example.com', phone: null },
    { id: 'u-staff', email: 'staff@example.com', phone: '+919800000001' },
    { id: 'u-packer', email: 'packer@example.com', phone: null },
  ]
  await owner.insert(authSchema.user).values(users.map((u) => ({ ...u, name: u.id })))
  const on = { email: true, whatsapp: true, push: false }
  const prefs: MemberAlertPrefs = {
    ...parseMemberAlertPrefs(null, false),
    weeklyReport: { ...on, lastSentOn: null },
    monthlyReport: { ...on, lastSentOn: null },
  }
  await withStore(owner, storeId, async (tx) => {
    await seedSystemRoles(tx, storeId)
    const roles = await listRoles(tx, storeId)
    const roleOf = (slug: string) => roles.find((r) => r.slug === slug)?.id as string
    const noOrders = await saveRole(tx, { storeId, name: 'Content only', permissions: [] })
    await upsertMember(tx, { storeId, userId: 'u-owner', roleId: roleOf('owner') })
    await upsertMember(tx, { storeId, userId: 'u-staff', roleId: roleOf('staff') })
    await upsertMember(tx, { storeId, userId: 'u-packer', roleId: noOrders })
    for (const userId of ['u-staff', 'u-packer']) {
      await tx
        .update(storeMember)
        .set({ notificationPrefs: prefs })
        .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, userId)))
    }
  })
  const [cu] = await owner
    .insert(customer)
    .values({ storeId, email: 'a@example.com', name: 'A' })
    .returning()
  const row = (
    number: number,
    placedAt: string,
    subtotalPaise: number,
    over: Partial<typeof order.$inferInsert> = {},
  ) => ({
    storeId,
    number,
    status: 'open' as const,
    subtotalPaise,
    totalPaise: subtotalPaise - (over.discountPaise ?? 0),
    paymentMethod: 'cod',
    email: 'a@example.com',
    placedAt: ist(placedAt),
    ...over,
  })
  await owner.insert(order).values([
    // The week before: a guest, ₹500 net.
    row(1, '2026-11-03T12:00', 50_000),
    // Last week (9–15 Nov): ₹500 less ₹50 off on Tuesday, then ₹1,000 on Saturday from Social.
    row(2, '2026-11-10T11:00', 50_000, { customerId: cu?.id, discountPaise: 5_000 }),
    row(3, '2026-11-14T19:00', 100_000, {
      customerId: cu?.id,
      attribution: { channel: 'social', at: '2026-11-14T13:00:00.000Z' },
    }),
    // Never counted: a cancelled order and a draft.
    row(4, '2026-11-12T10:00', 900_000, { status: 'cancelled' }),
    row(5, '2026-11-12T10:00', 900_000, { status: 'draft' }),
  ])
  await owner.insert(marketingSession).values(
    [1, 2, 3, 4].map((i) => ({
      storeId,
      visitorId: `v${i}`,
      channel: 'direct',
      startedAt: ist('2026-11-13T10:00'),
    })),
  )
  return { storeId }
}

const opts = (channels: NotificationChannel[], now: Date) => ({
  registry,
  settingsSecret: 'test-settings-secret',
  adminUrl: 'https://admin.example.com/',
  channels,
  now,
})

describe('weekly report', () => {
  it('goes on Monday from 9:00, once, by email only, to members who may see orders', async () => {
    const { storeId } = await seed()
    const email = recorder('email', 'email')
    const whatsapp = recorder('whatsapp', 'phone')
    const send = (now: Date) =>
      withStore(app, storeId, (tx) =>
        sendDueReports({ storeId, tx }, 'weeklyReport', opts([email, whatsapp], now)),
      )

    expect(await send(ist('2026-11-16T08:50'))).toBe(0)
    expect(await send(ist('2026-11-16T09:30'))).toBe(1)
    expect(await send(ist('2026-11-16T09:40'))).toBe(0)
    expect(whatsapp.sent).toEqual([])
    expect(email.sent.map((m) => [m.to.email, m.template])).toEqual([
      ['staff@example.com', 'staff_weekly_report'],
    ])
  })

  it('carries last week’s figures by the Analytics rules', async () => {
    const { storeId } = await seed()
    const email = recorder('email', 'email')
    await withStore(app, storeId, (tx) =>
      sendDueReports({ storeId, tx }, 'weeklyReport', opts([email], ist('2026-11-16T09:30'))),
    )
    const r = email.sent[0]?.data.report
    expect(r?.periodLabel).toBe('Monday 9 – Sunday 15 November')
    // ₹1,500 gross less ₹50 off; the cancelled order and the draft are left out.
    expect(r?.netLabel).toBe('₹1,450')
    expect(r?.change).toEqual({ label: '▲ 190%', up: true })
    expect(r?.stats.slice(0, 2).map((s) => s.value)).toEqual(['2', '4'])
    expect(r?.stats.find((s) => s.label === 'New customers')?.value).toBe('1')
    expect(r?.stats.find((s) => s.label === 'Repeat buyers')?.value).toBe('50%')
    expect(r?.bars.find((b) => b.best)?.label).toBe('Sat')
    expect(r?.sources).toEqual([{ label: 'Social', percent: 100 }])
    expect(email.sent[0]?.data.storeName).toBe('Test Shop')
  })

  it('records the week it sent, so saving the switches again does not send it twice', async () => {
    const { storeId } = await seed()
    const email = recorder('email', 'email')
    await withStore(app, storeId, (tx) =>
      sendDueReports({ storeId, tx }, 'weeklyReport', opts([email], ist('2026-11-16T09:30'))),
    )
    const [m] = await owner
      .select({ prefs: storeMember.notificationPrefs })
      .from(storeMember)
      .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, 'u-staff')))
    expect(parseMemberAlertPrefs(m?.prefs, false).weeklyReport.lastSentOn).toBe('2026-11-09')
  })
})

describe('the worker sweep', () => {
  it('finds stores where a member turned a report on', async () => {
    const { storeId } = await seed()
    expect(await storesWithMemberReports(app)).toEqual([storeId])
  })
})

describe('monthly report', () => {
  it('waits for the 1st', async () => {
    const { storeId } = await seed()
    const email = recorder('email', 'email')
    const sent = await withStore(app, storeId, (tx) =>
      sendDueReports({ storeId, tx }, 'monthlyReport', opts([email], ist('2026-11-16T09:30'))),
    )
    expect(sent).toBe(0)
    const first = await withStore(app, storeId, (tx) =>
      sendDueReports({ storeId, tx }, 'monthlyReport', opts([email], ist('2026-12-01T09:30'))),
    )
    expect(first).toBe(1)
    expect(email.sent[0]?.data.report?.kicker).toBe('Monthly report · November 2026')
  })
})
