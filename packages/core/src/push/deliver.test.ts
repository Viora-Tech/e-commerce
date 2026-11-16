/** SOURCE OF TRUTH: staff push delivery tests — WHAT: who gets a push for a new order, an approval and an AI app request, that their own Push switch and role are respected, that a gone device is dropped and that a test reaches only its member / WHY: a push lands on someone's phone, so a wrong filter shows orders to staff who may not see them */
import {
  aiAction,
  authSchema,
  createDb,
  memberPushSubscription,
  order,
  outboxEvent,
  store,
  storeMember,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { parseMemberAlertPrefs } from '../member-account/alert-prefs'
import { listRoles, saveRole, seedSystemRoles, upsertMember } from '../permissions/service'
import { deliverPushJob, type PushSender } from './deliver'
import { savePushSubscription } from './subscriptions'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-settings-secret'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** Records every send; endpoints listed in `gone` answer 410. */
function fakeSender(
  gone: string[] = [],
): PushSender & { sent: { endpoint: string; payload: string }[] } {
  const sent: { endpoint: string; payload: string }[] = []
  const send: PushSender = async (device, payload) => {
    if (gone.includes(device.endpoint)) return { ok: false, gone: true, error: '410 Gone' }
    sent.push({ endpoint: device.endpoint, payload })
    return { ok: true }
  }
  return Object.assign(send, { sent })
}

const endpoint = (userId: string) => `https://push.example.com/${userId}`

/** Owner, two staff, and a member whose role cannot see orders, each with one device. */
async function seed() {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const storeId = s.id
  const users = ['u-owner', 'u-staff', 'u-quiet', 'u-packer']
  await owner
    .insert(authSchema.user)
    .values(users.map((id) => ({ id, name: id, email: `${id}@example.com` })))
  await withStore(owner, storeId, async (tx) => {
    await seedSystemRoles(tx, storeId)
    const roles = await listRoles(tx, storeId)
    const roleOf = (slug: string) => roles.find((r) => r.slug === slug)?.id as string
    const noOrders = await saveRole(tx, { storeId, name: 'Content only', permissions: [] })
    await upsertMember(tx, { storeId, userId: 'u-owner', roleId: roleOf('owner') })
    await upsertMember(tx, { storeId, userId: 'u-staff', roleId: roleOf('staff') })
    await upsertMember(tx, { storeId, userId: 'u-quiet', roleId: roleOf('staff') })
    await upsertMember(tx, { storeId, userId: 'u-packer', roleId: noOrders })
    // u-quiet turned new-order push off.
    const quiet = parseMemberAlertPrefs(null, false)
    await tx
      .update(storeMember)
      .set({ notificationPrefs: { ...quiet, newOrder: { ...quiet.newOrder, push: false } } })
      .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, 'u-quiet')))
  })
  await withStore(app, storeId, async (tx) => {
    for (const userId of users) {
      await savePushSubscription(
        tx,
        storeId,
        userId,
        { endpoint: endpoint(userId), keys: { p256dh: `p-${userId}`, auth: `a-${userId}` } },
        SECRET,
      )
    }
  })
  return { storeId }
}

async function outbox(storeId: string, type: string, payload: Record<string, unknown>) {
  const [row] = await owner
    .insert(outboxEvent)
    .values({ storeId, type, payload })
    .returning({ id: outboxEvent.id })
  return row?.id as string
}

describe('deliverPushJob', () => {
  it('pushes a new order to members who may see orders and kept push on', async () => {
    const { storeId } = await seed()
    const [o] = await owner
      .insert(order)
      .values({
        storeId,
        number: 2481,
        status: 'open',
        subtotalPaise: 249900,
        totalPaise: 249900,
        paymentMethod: 'cod',
        email: 'asha@example.com',
      })
      .returning()
    const outboxId = await outbox(storeId, 'order.placed', { orderId: o?.id })
    const send = fakeSender()
    const r = await deliverPushJob(app, { storeId, outboxId }, { send, settingsSecret: SECRET })
    expect(send.sent.map((s) => s.endpoint).sort()).toEqual([
      endpoint('u-owner'),
      endpoint('u-staff'),
    ])
    expect(r).toMatchObject({ members: 2, sent: 2, failed: 0 })
    const payload = JSON.parse(send.sent[0]?.payload ?? '{}')
    expect(payload).toMatchObject({
      title: 'New order #2481',
      url: `/orders/${o?.id}`,
      tag: `order-${o?.id}`,
      storeId,
    })
    expect(payload.body).toContain('2,499')
  })

  it('drops a device the push service says is gone', async () => {
    const { storeId } = await seed()
    const [o] = await owner
      .insert(order)
      .values({ storeId, number: 1, status: 'open', subtotalPaise: 100, totalPaise: 100 })
      .returning()
    const outboxId = await outbox(storeId, 'order.placed', { orderId: o?.id })
    const send = fakeSender([endpoint('u-staff')])
    const r = await deliverPushJob(app, { storeId, outboxId }, { send, settingsSecret: SECRET })
    expect(r).toMatchObject({ sent: 1, gone: 1 })
    const left = await owner
      .select({ userId: memberPushSubscription.userId })
      .from(memberPushSubscription)
    expect(left.map((l) => l.userId)).not.toContain('u-staff')
  })

  it('sends an approval waiting in Approvals to approvers, never to the member who asked', async () => {
    const { storeId } = await seed()
    const [a] = await owner
      .insert(aiAction)
      .values({
        storeId,
        userId: 'u-staff',
        source: 'admin',
        tool: 'runAdminAction',
        summary: 'Refund ₹499 on order #2471',
        input: {},
        preview: { rows: [], more: 0 },
        needsApprover: true,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      .returning()
    const outboxId = await outbox(storeId, 'approval.requested', { actionId: a?.id })
    const send = fakeSender()
    await deliverPushJob(app, { storeId, outboxId }, { send, settingsSecret: SECRET })
    expect(send.sent.map((s) => s.endpoint)).toEqual([endpoint('u-owner')])
    expect(JSON.parse(send.sent[0]?.payload ?? '{}')).toMatchObject({
      title: 'Approval waiting',
      body: 'Refund ₹499 on order #2471',
      url: '/settings/approvals',
    })
  })

  it("sends an AI app's request only to its own member, and nothing once it is decided", async () => {
    const { storeId } = await seed()
    const [a] = await owner
      .insert(aiAction)
      .values({
        storeId,
        userId: 'u-staff',
        source: 'mcp',
        tool: 'proposeOrderNote',
        summary: 'Add a note to #2462',
        input: {},
        preview: { rows: [], more: 0 },
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      .returning()
    const outboxId = await outbox(storeId, 'approval.requested', { actionId: a?.id })
    const send = fakeSender()
    await deliverPushJob(app, { storeId, outboxId }, { send, settingsSecret: SECRET })
    expect(send.sent.map((s) => s.endpoint)).toEqual([endpoint('u-staff')])

    await owner
      .update(aiAction)
      .set({ status: 'executed' })
      .where(eq(aiAction.id, a?.id as string))
    const later = fakeSender()
    await deliverPushJob(app, { storeId, outboxId }, { send: later, settingsSecret: SECRET })
    expect(later.sent).toEqual([])
  })

  it('sends a test to the one member, whatever their switches', async () => {
    const { storeId } = await seed()
    const send = fakeSender()
    await deliverPushJob(app, { storeId, testUserId: 'u-quiet' }, { send, settingsSecret: SECRET })
    expect(send.sent.map((s) => s.endpoint)).toEqual([endpoint('u-quiet')])
  })

  it('retries when every send failed for a reason other than a gone device', async () => {
    const { storeId } = await seed()
    const send: PushSender = async () => ({ ok: false, gone: false, error: '503 busy' })
    await expect(
      deliverPushJob(app, { storeId, testUserId: 'u-owner' }, { send, settingsSecret: SECRET }),
    ).rejects.toThrow('503')
  })
})
