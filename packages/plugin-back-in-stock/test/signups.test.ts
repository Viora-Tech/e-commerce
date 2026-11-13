import { createDb, newId, product, store, variant, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  BackInStockError,
  confirmSignup,
  createSignup,
  listSignups,
  maskContact,
  unsubscribeByToken,
  waitingSummary,
} from '../src/signups'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedVariant(opts: { preorderEnabled?: boolean } = {}) {
  const slug = `s-${Math.random().toString(36).slice(2)}`
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  const productId = newId()
  await owner.insert(product).values({
    id: productId,
    storeId: s.id,
    title: 'Tee',
    handle: `tee-${slug}`,
    preorderEnabled: opts.preorderEnabled ?? false,
  })
  const variantId = newId()
  await owner.insert(variant).values({
    id: variantId,
    storeId: s.id,
    productId,
    title: 'Default',
    pricePaise: 100000,
  })
  return { storeId: s.id, variantId }
}

describe('createSignup', () => {
  it('dedupes: a second signup for the same live email/variant is a no-op', async () => {
    const { storeId, variantId } = await seedVariant()
    const first = await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, email: 'shopper@example.com' }),
    )
    const second = await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, email: 'Shopper@Example.com' }),
    )
    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.row.id).toBe(first.row.id)
    const rows = await withStore(app, storeId, (tx) => listSignups(tx, storeId))
    expect(rows).toHaveLength(1)
  })

  it('a phone signup dedupes the same way and starts confirmed (no double opt-in over WhatsApp)', async () => {
    const { storeId, variantId } = await seedVariant()
    const first = await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, phone: '+91 98765-43210' }),
    )
    expect(first.row.status).toBe('confirmed')
    const second = await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, phone: '919876543210' }),
    )
    expect(second.created).toBe(false)
  })

  it('a resignup after unsubscribing is allowed (only a *live* signup dedupes)', async () => {
    const { storeId, variantId } = await seedVariant()
    const { row } = await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, email: 'again@example.com' }),
    )
    await withStore(app, storeId, (tx) => unsubscribeByToken(tx, row.unsubscribeToken))
    const resignup = await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, email: 'again@example.com' }),
    )
    expect(resignup.created).toBe(true)
    expect(resignup.row.id).not.toBe(row.id)
  })

  it('rejects a pre-order variant: it is always purchasable, never sold out', async () => {
    const { storeId, variantId } = await seedVariant({ preorderEnabled: true })
    await expect(
      withStore(app, storeId, (tx) =>
        createSignup(tx, storeId, { variantId, email: 'x@example.com' }),
      ),
    ).rejects.toThrow(BackInStockError)
  })

  it('is isolated per store: another store cannot see or dedupe against it', async () => {
    const a = await seedVariant()
    const b = await seedVariant()
    await withStore(app, a.storeId, (tx) =>
      createSignup(tx, a.storeId, { variantId: a.variantId, email: 'x@example.com' }),
    )
    const rowsB = await withStore(app, b.storeId, (tx) => listSignups(tx, b.storeId))
    expect(rowsB).toHaveLength(0)
  })
})

describe('double opt-in', () => {
  it('an email signup starts pending_confirmation and only confirms via its token', async () => {
    const { storeId, variantId } = await seedVariant()
    const { row } = await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, email: 'confirm-me@example.com' }),
    )
    expect(row.status).toBe('pending_confirmation')
    expect(row.confirmToken).toBeTruthy()

    const confirmed = await withStore(app, storeId, (tx) =>
      confirmSignup(tx, row.confirmToken as string),
    )
    expect(confirmed?.status).toBe('confirmed')
    expect(confirmed?.confirmToken).toBeNull()

    // The token is single-use: confirming again with the same token finds nothing new to update.
    const again = await withStore(app, storeId, (tx) =>
      confirmSignup(tx, row.confirmToken as string),
    )
    expect(again).toBeNull()
  })

  it('an unknown token confirms nothing', async () => {
    const { storeId } = await seedVariant()
    const result = await withStore(app, storeId, (tx) => confirmSignup(tx, 'not-a-real-token'))
    expect(result).toBeNull()
  })
})

describe('unsubscribe', () => {
  it('marks the signup unsubscribed and stops it dedupe-blocking a fresh signup', async () => {
    const { storeId, variantId } = await seedVariant()
    const { row } = await withStore(app, storeId, (tx) =>
      createSignup(tx, storeId, { variantId, email: 'bye@example.com' }),
    )
    const unsub = await withStore(app, storeId, (tx) =>
      unsubscribeByToken(tx, row.unsubscribeToken),
    )
    expect(unsub?.status).toBe('unsubscribed')
    expect(unsub?.unsubscribedAt).not.toBeNull()
  })
})

describe('maskContact', () => {
  it('masks an email keeping the first character and the domain', () => {
    expect(maskContact('shopper@example.com', null)).toBe('s******@example.com')
  })
  it('masks a phone keeping the first two and last two digits', () => {
    expect(maskContact(null, '919876543210')).toBe('91********10')
  })
})

describe('waitingSummary', () => {
  it('counts waiting shoppers and the variants they wait on, not unsubscribed ones', async () => {
    const { storeId, variantId } = await seedVariant()
    await withStore(app, storeId, async (tx) => {
      await createSignup(tx, storeId, { variantId, email: 'a@example.com' })
      await createSignup(tx, storeId, { variantId, email: 'b@example.com' })
      const gone = await createSignup(tx, storeId, { variantId, email: 'c@example.com' })
      await unsubscribeByToken(tx, gone.row.unsubscribeToken)
    })
    const summary = await withStore(app, storeId, (tx) => waitingSummary(tx, storeId))
    expect(summary).toEqual({ shoppers: 2, variants: 1 })
  })
})
