import { builtInPaymentRegistry } from '@commerce/core'
import { createDb, order, payment, store, storeDomain, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { isWebsiteNotRegistered } from '@commerce/payments/failure-reasons'
import { razorpayFactory } from '@commerce/payments-razorpay'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { paymentsSetup } from '../src/services/payments-setup.service'
import {
  latestRazorpayWebsiteBlock,
  razorpayWebsites,
} from '../src/services/razorpay-websites.service'

/** The websites a merchant must list in Razorpay, and the warning after Razorpay blocks one. */
const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

const BLOCKED =
  'Payment blocked as website does not match registered website(s) (payment_risk_check_failed)'
const now = new Date('2026-10-21T10:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60_000)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function makeStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  return s?.id as string
}

async function makeOrder(storeId: string) {
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: 1,
      status: 'open',
      subtotalPaise: 100,
      totalPaise: 100,
      paymentMethod: 'razorpay',
    })
    .returning()
  return o?.id as string
}

async function failedPayment(
  storeId: string,
  orderId: string,
  values: { error: string | null; createdAt: Date; provider?: string; status?: 'failed' },
) {
  await owner.insert(payment).values({
    storeId,
    orderId,
    provider: values.provider ?? 'razorpay',
    providerRef: `order_${Math.random().toString(36).slice(2)}`,
    status: values.status ?? 'failed',
    amountPaise: 100,
    error: values.error,
    createdAt: values.createdAt,
  })
}

describe('razorpayWebsites', () => {
  it('lists the platform subdomain and every live custom domain, primary first', async () => {
    const storeId = await makeStore('waimers')
    const other = await makeStore('other')
    await owner.insert(storeDomain).values([
      { storeId, hostname: 'waimers.koomerce.app', kind: 'platform', isPrimary: false },
      { storeId, hostname: 'waimers.in', kind: 'custom', isPrimary: true },
      { storeId, hostname: 'shop.waimers.in', kind: 'custom' },
      { storeId, hostname: 'new.waimers.in', kind: 'custom', status: 'pending' },
      { storeId, hostname: 'waimers.localhost', kind: 'platform' },
      { storeId: other, hostname: 'other.koomerce.app', kind: 'platform', isPrimary: true },
    ])
    const sites = await withStore(app, storeId, (tx) => razorpayWebsites(tx, storeId))
    expect(sites).toEqual(['waimers.in', 'waimers.koomerce.app', 'shop.waimers.in'])
  })

  it('is empty for a store with no live address', async () => {
    const storeId = await makeStore('bare')
    expect(await withStore(app, storeId, (tx) => razorpayWebsites(tx, storeId))).toEqual([])
  })
})

describe('latestRazorpayWebsiteBlock', () => {
  it('finds a Razorpay payment refused for its website in the last 7 days', async () => {
    const storeId = await makeStore('blocked')
    const orderId = await makeOrder(storeId)
    await failedPayment(storeId, orderId, { error: BLOCKED, createdAt: daysAgo(2) })
    await failedPayment(storeId, orderId, { error: 'Card declined', createdAt: daysAgo(1) })
    const block = await withStore(app, storeId, (tx) =>
      latestRazorpayWebsiteBlock(tx, storeId, now),
    )
    expect(block).toEqual({ at: daysAgo(2).toISOString(), orderId, error: BLOCKED })
  })

  it('ignores old blocks, other reasons, other gateways and other stores', async () => {
    const storeId = await makeStore('quiet')
    const orderId = await makeOrder(storeId)
    await failedPayment(storeId, orderId, { error: BLOCKED, createdAt: daysAgo(8) })
    await failedPayment(storeId, orderId, { error: 'Card declined', createdAt: daysAgo(1) })
    await failedPayment(storeId, orderId, {
      error: BLOCKED,
      createdAt: daysAgo(1),
      provider: 'cashfree',
    })
    const other = await makeStore('loud')
    await failedPayment(other, await makeOrder(other), { error: BLOCKED, createdAt: daysAgo(1) })
    const block = await withStore(app, storeId, (tx) =>
      latestRazorpayWebsiteBlock(tx, storeId, now),
    )
    expect(block).toBeNull()
  })

  it('recognises the website failure text and nothing else', () => {
    expect(isWebsiteNotRegistered(BLOCKED)).toBe(true)
    expect(isWebsiteNotRegistered('website not registered (payment_risk_check_failed)')).toBe(true)
    expect(isWebsiteNotRegistered('payment_risk_check_failed')).toBe(false)
    expect(isWebsiteNotRegistered('Card declined')).toBe(false)
    expect(isWebsiteNotRegistered(null)).toBe(false)
  })
})

describe('paymentsSetup', () => {
  it('serves the websites and the block with the rest of Settings → Payments', async () => {
    const storeId = await makeStore('setup')
    await owner
      .insert(storeDomain)
      .values({ storeId, hostname: 'setup.koomerce.app', kind: 'platform', isPrimary: true })
    await failedPayment(storeId, await makeOrder(storeId), {
      error: BLOCKED,
      createdAt: daysAgo(1),
    })
    const setup = await withStore(app, storeId, (tx) =>
      paymentsSetup(
        tx,
        storeId,
        builtInPaymentRegistry().register(razorpayFactory),
        [],
        {
          secret: 'test-secret-test-secret-test-secret-1234',
          previousSecrets: [],
          workerUrl: 'https://worker.example.com',
          storefrontUrl: 'https://shop.example.com',
          razorpayOAuth: false,
        },
        now,
      ),
    )
    expect(setup.razorpayWebsites).toEqual(['setup.koomerce.app'])
    expect(setup.razorpayWebsiteBlock?.error).toBe(BLOCKED)
  })
})
