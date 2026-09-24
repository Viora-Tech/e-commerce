import { createDb, newId, product, store, variant, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { NotificationChannel, SendResult } from '@commerce/notifications'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sendRestockAlerts } from '../src/notify'
import { usageThisMonth } from '../src/quota'
import { createSignup } from '../src/signups'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedVariant() {
  const slug = `s-${Math.random().toString(36).slice(2)}`
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  const productId = newId()
  await owner
    .insert(product)
    .values({ id: productId, storeId: s.id, title: 'Tee', handle: `tee-${slug}` })
  const variantId = newId()
  await owner
    .insert(variant)
    .values({ id: variantId, storeId: s.id, productId, title: 'Default', pricePaise: 100000 })
  return { storeId: s.id, variantId }
}

function fakeChannel(
  id: string,
  requires: 'email' | 'phone',
  result: SendResult = { ok: true, providerRef: 'x' },
) {
  const calls: unknown[] = []
  const channel: NotificationChannel = {
    id,
    label: id,
    requires,
    send: async (message) => {
      calls.push(message)
      return result
    },
  }
  return { channel, calls }
}

const noopSleep = async () => {}
const quota = { freeEmailPerMonth: 1000, freeWhatsappPerMonth: 1000 }

describe('sendRestockAlerts', () => {
  it('sends exactly one message per confirmed signup, ignoring pending and unsubscribed ones', async () => {
    const { storeId, variantId } = await seedVariant()
    const emailA = await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, email: 'a@example.com' }),
    )
    const emailB = await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, email: 'b@example.com' }),
    )
    const { confirmSignup } = await import('../src/signups')
    await withStore(app, storeId, (tx) => confirmSignup(tx, emailA.row.confirmToken as string))
    await withStore(app, storeId, (tx) => confirmSignup(tx, emailB.row.confirmToken as string))
    // A phone signup starts confirmed already.
    await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, phone: '919876543210' }),
    )
    // A signup that never confirmed must not be messaged.
    await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, email: 'c@example.com' }),
    )

    const email = fakeChannel('log', 'email')
    const whatsapp = fakeChannel('whatsapp', 'phone')

    const outcome = await sendRestockAlerts(
      {
        inStore: (fn) => withStore(app, storeId, fn),
        channels: [email.channel, whatsapp.channel],
        quota,
        unlimited: false,
        batchSize: 200,
        availableStock: async () => 5,
        buildMessage: () => ({
          data: {
            storeName: 'Store',
            customerName: '',
            totalLabel: '',
            lines: [],
            paymentMethodLabel: '',
            backInStock: { productTitle: 'Tee', unsubscribeUrl: 'https://x/u' },
          },
        }),
        sleep: noopSleep,
      },
      storeId,
      variantId,
    )

    expect(outcome).toMatchObject({ sent: 3, skippedQuota: 0, failed: 0, stoppedForStock: false })
    expect(email.calls).toHaveLength(2)
    expect(whatsapp.calls).toHaveLength(1)
  })

  it('throttles into batches, sleeping between them', async () => {
    const { storeId, variantId } = await seedVariant()
    for (const e of ['1@example.com', '2@example.com', '3@example.com']) {
      await withStore(app, storeId, (tx) =>
        createSignup(tx, storeId, { variantId, phone: undefined, email: e }),
      )
    }
    // Confirm all three via a fresh query, simplest: fetch tokens and confirm each.
    const { confirmSignup, listSignups } = await import('../src/signups')
    const rows = await withStore(app, storeId, (tx) => listSignups(tx, storeId))
    for (const r of rows) {
      if (r.confirmToken)
        await withStore(app, storeId, (tx) => confirmSignup(tx, r.confirmToken as string))
    }

    const email = fakeChannel('log', 'email')
    let sleeps = 0
    const outcome = await sendRestockAlerts(
      {
        inStore: (fn) => withStore(app, storeId, fn),
        channels: [email.channel],
        quota,
        unlimited: false,
        batchSize: 1,
        availableStock: async () => 5,
        buildMessage: () => ({
          data: {
            storeName: '',
            customerName: '',
            totalLabel: '',
            lines: [],
            paymentMethodLabel: '',
            backInStock: { productTitle: 'Tee', unsubscribeUrl: 'https://x/u' },
          },
        }),
        sleep: async () => {
          sleeps += 1
        },
      },
      storeId,
      variantId,
    )
    expect(outcome.sent).toBe(3)
    // 3 batches of 1: two gaps between them.
    expect(sleeps).toBe(2)
  })

  it('pauses at the free quota, leaving the rest confirmed for next time', async () => {
    const { storeId, variantId } = await seedVariant()
    const one = await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, email: 'q1@example.com' }),
    )
    const two = await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, email: 'q2@example.com' }),
    )
    const { confirmSignup, listSignups } = await import('../src/signups')
    await withStore(app, storeId, (tx) => confirmSignup(tx, one.row.confirmToken as string))
    await withStore(app, storeId, (tx) => confirmSignup(tx, two.row.confirmToken as string))

    const email = fakeChannel('log', 'email')
    const outcome = await sendRestockAlerts(
      {
        inStore: (fn) => withStore(app, storeId, fn),
        channels: [email.channel],
        quota: { freeEmailPerMonth: 1, freeWhatsappPerMonth: 0 },
        unlimited: false,
        batchSize: 200,
        availableStock: async () => 5,
        buildMessage: () => ({
          data: {
            storeName: '',
            customerName: '',
            totalLabel: '',
            lines: [],
            paymentMethodLabel: '',
            backInStock: { productTitle: 'Tee', unsubscribeUrl: 'https://x/u' },
          },
        }),
        sleep: noopSleep,
      },
      storeId,
      variantId,
    )
    expect(outcome).toMatchObject({ sent: 1, skippedQuota: 1 })
    const used = await withStore(app, storeId, (tx) => usageThisMonth(tx, storeId, 'email'))
    expect(used).toBe(1)
    const remaining = await withStore(app, storeId, (tx) =>
      listSignups(tx, storeId, { status: 'confirmed' }),
    )
    expect(remaining).toHaveLength(1)
  })

  it('an unlimited store ignores the free quota entirely', async () => {
    const { storeId, variantId } = await seedVariant()
    const one = await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, email: 'u1@example.com' }),
    )
    const two = await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, email: 'u2@example.com' }),
    )
    const { confirmSignup } = await import('../src/signups')
    await withStore(app, storeId, (tx) => confirmSignup(tx, one.row.confirmToken as string))
    await withStore(app, storeId, (tx) => confirmSignup(tx, two.row.confirmToken as string))

    const email = fakeChannel('log', 'email')
    const outcome = await sendRestockAlerts(
      {
        inStore: (fn) => withStore(app, storeId, fn),
        channels: [email.channel],
        quota: { freeEmailPerMonth: 1, freeWhatsappPerMonth: 0 },
        unlimited: true,
        batchSize: 200,
        availableStock: async () => 5,
        buildMessage: () => ({
          data: {
            storeName: '',
            customerName: '',
            totalLabel: '',
            lines: [],
            paymentMethodLabel: '',
            backInStock: { productTitle: 'Tee', unsubscribeUrl: 'https://x/u' },
          },
        }),
        sleep: noopSleep,
      },
      storeId,
      variantId,
    )
    expect(outcome).toMatchObject({ sent: 2, skippedQuota: 0 })
  })

  it('stops mid-send if stock runs out between batches', async () => {
    const { storeId, variantId } = await seedVariant()
    const one = await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, email: 's1@example.com' }),
    )
    const two = await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, email: 's2@example.com' }),
    )
    const { confirmSignup, listSignups } = await import('../src/signups')
    await withStore(app, storeId, (tx) => confirmSignup(tx, one.row.confirmToken as string))
    await withStore(app, storeId, (tx) => confirmSignup(tx, two.row.confirmToken as string))

    const email = fakeChannel('log', 'email')
    let call = 0
    const outcome = await sendRestockAlerts(
      {
        inStore: (fn) => withStore(app, storeId, fn),
        channels: [email.channel],
        quota,
        unlimited: false,
        batchSize: 1,
        availableStock: async () => {
          call += 1
          return call === 1 ? 5 : 0
        },
        buildMessage: () => ({
          data: {
            storeName: '',
            customerName: '',
            totalLabel: '',
            lines: [],
            paymentMethodLabel: '',
            backInStock: { productTitle: 'Tee', unsubscribeUrl: 'https://x/u' },
          },
        }),
        sleep: noopSleep,
      },
      storeId,
      variantId,
    )
    expect(outcome).toMatchObject({ sent: 1, stoppedForStock: true })
    const remaining = await withStore(app, storeId, (tx) =>
      listSignups(tx, storeId, { status: 'confirmed' }),
    )
    expect(remaining).toHaveLength(1)
  })
})
