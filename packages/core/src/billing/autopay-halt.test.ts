/** SOURCE OF TRUTH: AutoPay halt email tests — WHAT: a halted UPI AutoPay mandate emails the owner once / WHY: owners hear at once, not at the overdue email */
import { createHmac } from 'node:crypto'
import { autopayMandate, createDb } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { seedSalesStore, seedStore } from '../testing/usage-seed'
import { type AutopayConfig, handleAutopayWebhook } from './autopay'

const sent = vi.hoisted(() => [] as unknown[])
vi.mock('./emails', async (load) => ({
  ...(await load<typeof import('./emails')>()),
  sendPlanBillEmail: async (_db: unknown, storeId: string, input: unknown) => {
    sent.push({ storeId, input })
    return 'sent' as const
  },
}))

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const cfg: AutopayConfig = {
  keyId: 'rzp_test',
  keySecret: 'secret',
  webhookSecret: 'whsec_test',
  fetch: (() => {
    throw new Error('no Razorpay calls in this test')
  }) as unknown as typeof fetch,
}

function webhook(event: string) {
  const raw = JSON.stringify({
    event,
    payload: { subscription: { entity: { id: 'sub_halt' } } },
  })
  return { raw, signature: createHmac('sha256', cfg.webhookSecret).update(raw).digest('hex') }
}

describe('AutoPay halt', () => {
  it('emails the owner once when Razorpay halts the mandate', async () => {
    const billing = {
      salesStoreId: await seedSalesStore(owner),
      settingsSecret: 'test-secret-test-secret-test-secret',
      salesStorefrontUrl: 'https://sales.example.test',
    }
    const id = await seedStore(owner, 'asha')
    await owner.insert(autopayMandate).values({
      storeId: id,
      plan: 'growth',
      interval: 'month',
      subscriptionId: 'sub_halt',
      status: 'active',
    })
    const halted = webhook('subscription.halted')
    expect(await handleAutopayWebhook(app, halted.raw, halted.signature, cfg, billing)).toBe('ok')
    const [m] = await owner.select().from(autopayMandate).where(eq(autopayMandate.storeId, id))
    expect(m?.status).toBe('halted')
    expect(sent).toEqual([
      {
        storeId: id,
        input: expect.objectContaining({
          kind: 'autopay_failed',
          what: 'Growth plan (monthly)',
          url: expect.stringMatching(/\/settings\/billing$/),
        }),
      },
    ])

    // Razorpay repeats webhooks: the second halt sends nothing.
    expect(await handleAutopayWebhook(app, halted.raw, halted.signature, cfg, billing)).toBe('ok')
    expect(sent).toHaveLength(1)

    // Other status changes send nothing.
    const resumed = webhook('subscription.resumed')
    await handleAutopayWebhook(app, resumed.raw, resumed.signature, cfg, billing)
    expect(sent).toHaveLength(1)
  })
})
