import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createDb, newId, outboxEvent, product, store, variant, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  alertMessageData,
  BACK_IN_STOCK_CONFIRM_PATH,
  BACK_IN_STOCK_UNSUBSCRIBE_PATH,
  confirmMessageFor,
} from '../src/messages'
import { confirmSignup, createSignup } from '../src/signups'

/*
 * The two messages a shopper gets: the confirm link right after an email signup (double
 * opt-in; without it no email signup is ever alerted), and the alert, whose links must open
 * real storefront routes.
 */

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
  const [s] = await owner.insert(store).values({ slug, name: 'Waimers Test' }).returning()
  if (!s) throw new Error('seed')
  const productId = newId()
  await owner
    .insert(product)
    .values({ id: productId, storeId: s.id, title: 'Glass pad', handle: 'glass-pad' })
  const variantId = newId()
  await owner
    .insert(variant)
    .values({ id: variantId, storeId: s.id, productId, title: 'Large', pricePaise: 100000 })
  return { storeId: s.id, variantId }
}

const confirmEvents = async (storeId: string) =>
  (await owner.select().from(outboxEvent).where(eq(outboxEvent.storeId, storeId))).filter(
    (e) => e.type === 'back_in_stock.confirm_requested',
  )

describe('confirm email', () => {
  it('an email signup queues its confirm message once; a repeat or a WhatsApp signup does not', async () => {
    const { storeId, variantId } = await seedVariant()
    const first = await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, email: 'shopper@example.com' }),
    )
    await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, email: 'shopper@example.com' }),
    )
    await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, phone: '98765 43210' }),
    )
    const events = await confirmEvents(storeId)
    expect(events).toHaveLength(1)
    expect(events[0]?.payload).toEqual({ backInStockSignupId: first.row.id })
  })

  it('builds the confirm message with links to the storefront routes, and nothing once confirmed', async () => {
    const { storeId, variantId } = await seedVariant()
    const { row } = await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, email: 'shopper@example.com' }),
    )
    const message = await withStore(app, storeId, (tx) =>
      confirmMessageFor(tx, row.id, 'https://shop.example'),
    )
    expect(message).toEqual({
      email: 'shopper@example.com',
      data: {
        backInStock: {
          productTitle: 'Glass pad',
          variantTitle: 'Large',
          confirmUrl: `https://shop.example/api/back-in-stock/confirm/${row.confirmToken}`,
          unsubscribeUrl: `https://shop.example/api/back-in-stock/unsubscribe/${row.unsubscribeToken}`,
        },
        links: [
          {
            label: 'Stop these alerts',
            url: `https://shop.example/api/back-in-stock/unsubscribe/${row.unsubscribeToken}`,
          },
        ],
      },
    })
    await withStore(app, storeId, (tx) => confirmSignup(tx, row.confirmToken as string))
    expect(
      await withStore(app, storeId, (tx) => confirmMessageFor(tx, row.id, 'https://shop.example')),
    ).toBeNull()
  })
})

describe('alert message', () => {
  it('names the store, links to the product and carries a working unsubscribe link', () => {
    const data = alertMessageData({
      storeName: 'Waimers Test',
      origin: 'https://shop.example/',
      productTitle: 'Glass pad',
      productHandle: 'glass-pad',
      variantTitle: 'Default',
      unsubscribeToken: 'tok123',
    })
    expect(data.storeName).toBe('Waimers Test')
    expect(data.backInStock).toEqual({
      productTitle: 'Glass pad',
      variantTitle: undefined,
      productUrl: 'https://shop.example/products/glass-pad',
      unsubscribeUrl: 'https://shop.example/api/back-in-stock/unsubscribe/tok123',
    })
    expect(data.links).toEqual([
      {
        label: 'Stop these alerts',
        url: 'https://shop.example/api/back-in-stock/unsubscribe/tok123',
      },
    ])
  })

  it('the confirm and unsubscribe paths are real storefront routes', () => {
    const api = join(__dirname, '../../../apps/storefront/src/app')
    expect(existsSync(join(api, BACK_IN_STOCK_CONFIRM_PATH, '[token]', 'route.ts'))).toBe(true)
    expect(existsSync(join(api, BACK_IN_STOCK_UNSUBSCRIBE_PATH, '[token]', 'route.ts'))).toBe(true)
  })
})
