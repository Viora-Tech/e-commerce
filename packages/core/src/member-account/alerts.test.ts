/** SOURCE OF TRUTH: member alert delivery tests — WHAT: who hears about a new order and who gets the daily summary, on which channel, and only once / WHY: these go to people, not the store, so a wrong filter mails order details to someone who may not see orders */
import { authSchema, createDb, customer, order, store, storeMember, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { Message, NotificationChannel } from '@commerce/notifications'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { builtInNotificationRegistry } from '../notifications/settings'
import { listRoles, saveRole, seedSystemRoles, upsertMember } from '../permissions/service'
import { type MemberAlertPrefs, parseMemberAlertPrefs } from './alert-prefs'
import { notifyMembersOfNewOrder, sendDueDailySummaries } from './alerts'

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

/** A store with an owner, staff with alerts on, someone whose role cannot see orders, and an order. */
async function seed(storeNotifications: unknown = null) {
  const [s] = await owner
    .insert(store)
    .values({ slug: 'w', name: 'Waimers', notifications: storeNotifications })
    .returning()
  if (!s) throw new Error('seed')
  const storeId = s.id
  const users = [
    { id: 'u-owner', email: 'owner@example.com', phone: null },
    { id: 'u-staff', email: 'staff@example.com', phone: '+919804682471' },
    { id: 'u-packer', email: 'packer@example.com', phone: null },
    { id: 'u-quiet', email: 'quiet@example.com', phone: null },
  ]
  await owner.insert(authSchema.user).values(users.map((u) => ({ ...u, name: u.id })))
  const on = { email: true, whatsapp: true }
  const staffPrefs: MemberAlertPrefs = {
    ...parseMemberAlertPrefs(null, false),
    newOrder: on,
    dailySummary: { ...on, hour: 9, lastSentOn: null },
  }
  await withStore(owner, storeId, async (tx) => {
    await seedSystemRoles(tx, storeId)
    const roles = await listRoles(tx, storeId)
    const roleOf = (slug: string) => roles.find((r) => r.slug === slug)?.id as string
    const noOrders = await saveRole(tx, { storeId, name: 'Content only', permissions: [] })
    await upsertMember(tx, { storeId, userId: 'u-owner', roleId: roleOf('owner') })
    await upsertMember(tx, { storeId, userId: 'u-staff', roleId: roleOf('staff') })
    await upsertMember(tx, { storeId, userId: 'u-packer', roleId: noOrders })
    await upsertMember(tx, { storeId, userId: 'u-quiet', roleId: roleOf('staff') })
    for (const userId of ['u-staff', 'u-packer']) {
      await tx
        .update(storeMember)
        .set({ notificationPrefs: staffPrefs })
        .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, userId)))
    }
  })
  const [cu] = await owner
    .insert(customer)
    .values({ storeId, email: 'asha@example.com', name: 'Asha' })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: 7,
      status: 'open',
      subtotalPaise: 199900,
      totalPaise: 204800,
      paymentMethod: 'cod',
      email: 'asha@example.com',
      customerId: cu?.id ?? null,
    })
    .returning()
  return { storeId, orderId: o?.id as string }
}

const opts = (channels: NotificationChannel[]) => ({
  registry,
  settingsSecret: 'test-settings-secret',
  adminUrl: 'https://admin.example.com/',
  channels,
})

describe('new-order alerts', () => {
  it('reach the owner by default and staff who asked, never someone who cannot see orders', async () => {
    const { storeId, orderId } = await seed()
    const email = recorder('email', 'email')
    const whatsapp = recorder('whatsapp', 'phone')
    await withStore(app, storeId, (tx) =>
      notifyMembersOfNewOrder({ storeId, tx }, orderId, opts([email, whatsapp])),
    )
    expect(email.sent.map((m) => m.to.email).sort()).toEqual([
      'owner@example.com',
      'staff@example.com',
    ])
    expect(whatsapp.sent.map((m) => m.to.phone)).toEqual(['919804682471'])
    expect(email.sent[0]).toMatchObject({
      template: 'staff_new_order',
      data: { orderNumber: 7, actionUrl: `https://admin.example.com/orders/${orderId}` },
    })
    expect(email.sent[0]?.data.orderUrl).toBeUndefined()
  })

  it('send nothing when the store switched the alert off', async () => {
    const { storeId, orderId } = await seed({ off: ['staff_new_order'] })
    const email = recorder('email', 'email')
    await withStore(app, storeId, (tx) =>
      notifyMembersOfNewOrder({ storeId, tx }, orderId, opts([email])),
    )
    expect(email.sent).toEqual([])
  })
})

describe('daily summary', () => {
  it('goes at the member’s hour, once a day, only to members who may see orders', async () => {
    const { storeId } = await seed()
    // 09:30 IST on 11 Oct 2026: the morning summary covers yesterday.
    const now = new Date('2026-10-11T04:00:00.000Z')
    const email = recorder('email', 'email')
    const send = () =>
      withStore(app, storeId, (tx) =>
        sendDueDailySummaries({ storeId, tx }, { ...opts([email]), now }),
      )
    expect(await send()).toBe(1)
    expect(await send()).toBe(0)
    expect(email.sent).toHaveLength(1)
    expect(email.sent[0]).toMatchObject({
      to: { email: 'staff@example.com' },
      template: 'staff_daily_summary',
      data: { dailySummary: { periodLabel: 'Yesterday', toShip: 0 } },
    })
  })

  it('waits for the chosen hour', async () => {
    const { storeId } = await seed()
    const email = recorder('email', 'email')
    const tenAm = new Date('2026-10-11T04:45:00.000Z')
    await withStore(app, storeId, (tx) =>
      sendDueDailySummaries({ storeId, tx }, { ...opts([email]), now: tenAm }),
    )
    expect(email.sent).toEqual([])
  })
})
