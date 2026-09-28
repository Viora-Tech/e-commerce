/** SOURCE OF TRUTH: plan sale invite tests — a paid platform-plan order on the sales store invites the buyer once; other stores, untagged products and missing emails invite nobody */
import { createDb, order, orderLine, product, signupInvite, store, variant } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { inviteForPaidPlanOrder } from './plan-invites'

const PLATFORM_PLAN_TAG = 'platform-plan'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

async function paidOrder(slug: string, tags: string[], email: string | null = 'Buyer@Example.com') {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  const storeId = s?.id as string
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: 'growth', title: 'Growth plan', tags })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: '1 year', pricePaise: 999_900 })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({ storeId, number: 1, email, subtotalPaise: 999_900, totalPaise: 999_900 })
    .returning()
  await owner.insert(orderLine).values({
    storeId,
    orderId: o?.id as string,
    variantId: v?.id as string,
    quantity: 1,
    unitPricePaise: 999_900,
  })
  return { storeId, orderId: o?.id as string }
}

describe('paid plan orders grant a signup invite', () => {
  it('invites the buyer once, however often the event is dispatched', async () => {
    const { storeId, orderId } = await paidOrder('sales', [PLATFORM_PLAN_TAG])
    const input = { storeId, orderId, salesStoreId: storeId }
    expect(await inviteForPaidPlanOrder(app, input)).toEqual({
      invited: true,
      email: 'buyer@example.com',
    })
    expect(await inviteForPaidPlanOrder(app, input)).toEqual({
      invited: false,
      reason: 'already_invited',
    })
    const invites = await owner.select().from(signupInvite)
    expect(invites).toHaveLength(1)
    expect(invites[0]?.email).toBe('buyer@example.com')
  })

  it('ignores every store but the sales store, even with the tag', async () => {
    const other = await paidOrder('someone-else', [PLATFORM_PLAN_TAG])
    const sales = await paidOrder('sales', [PLATFORM_PLAN_TAG])
    expect(await inviteForPaidPlanOrder(app, { ...other, salesStoreId: sales.storeId })).toEqual({
      invited: false,
      reason: 'not_sales_store',
    })
    expect(await inviteForPaidPlanOrder(app, { ...other, salesStoreId: undefined })).toEqual({
      invited: false,
      reason: 'not_sales_store',
    })
    expect(await owner.select().from(signupInvite)).toHaveLength(0)
  })

  it('ignores orders without a plan product or without an email', async () => {
    const plain = await paidOrder('sales', ['merch'])
    expect(await inviteForPaidPlanOrder(app, { ...plain, salesStoreId: plain.storeId })).toEqual({
      invited: false,
      reason: 'no_plan',
    })
    const noEmail = await paidOrder('sales2', [PLATFORM_PLAN_TAG], null)
    expect(
      await inviteForPaidPlanOrder(app, { ...noEmail, salesStoreId: noEmail.storeId }),
    ).toEqual({ invited: false, reason: 'no_email' })
  })
})
