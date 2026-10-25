import { createHmac } from 'node:crypto'
import { cart, createDb, inventoryLevel, product, store, variant, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  ABANDONED_AFTER_MS,
  abandonedStats,
  captureCartContact,
  cartsAwaitingRecovery,
  listAbandoned,
  RECOVERY_TTL_MS,
  recoveryToken,
  verifyRecoveryToken,
} from './abandoned'
import { addToCart, createCart } from './cart'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-secret-key'

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seed() {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Glasspad', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Black', pricePaise: 100000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 50 })
  return { storeId: s.id, variantId: v.id }
}

/** A cart with a contact and one line, last touched `minutesAgo` ago. */
async function quietCart(
  storeId: string,
  variantId: string,
  minutesAgo: number,
  email = 'shopper@example.in',
) {
  const at = new Date(Date.now() - minutesAgo * 60_000)
  return withStore(app, storeId, async (tx) => {
    const ctx = { storeId, tx }
    const cartId = await createCart(ctx)
    await addToCart(ctx, cartId, variantId, 1)
    await captureCartContact(ctx, cartId, { email, name: 'Aarav' })
    await tx.update(cart).set({ updatedAt: at, createdAt: at }).where(eq(cart.id, cartId))
    return cartId
  })
}

beforeEach(async () => {
  await resetDb(owner)
})

describe('recovery token', () => {
  it('round-trips the cart id', () => {
    const token = recoveryToken('11111111-2222-3333-4444-555555555555', SECRET)
    const r = verifyRecoveryToken(token, SECRET)
    expect(r).toEqual({ ok: true, cartId: '11111111-2222-3333-4444-555555555555' })
  })

  it('rejects a tampered id, a foreign secret and a malformed token', () => {
    const token = recoveryToken('11111111-2222-3333-4444-555555555555', SECRET)
    const [, expires, mac] = token.split('.')
    const tampered = `99999999-2222-3333-4444-555555555555.${expires}.${mac}`
    expect(verifyRecoveryToken(tampered, SECRET)).toEqual({ ok: false, reason: 'signature' })
    expect(verifyRecoveryToken(token, 'other-secret')).toEqual({ ok: false, reason: 'signature' })
    expect(verifyRecoveryToken('nonsense', SECRET)).toEqual({ ok: false, reason: 'malformed' })
  })

  it('expires', () => {
    const token = recoveryToken('11111111-2222-3333-4444-555555555555', SECRET)
    const later = new Date(Date.now() + RECOVERY_TTL_MS + 1000)
    expect(verifyRecoveryToken(token, SECRET, later)).toEqual({ ok: false, reason: 'expired' })
  })

  it('is domain-separated: a bare <id>.<expiry> HMAC (no purpose prefix) is rejected', () => {
    const cartId = '11111111-2222-3333-4444-555555555555'
    const expires = Date.now() + RECOVERY_TTL_MS
    const body = `${cartId}.${expires}`
    // A token signed the old way (secret over the bare body, no `recovery:` prefix)
    // must no longer verify, so it can never be swapped in for another token type.
    const bareMac = createHmac('sha256', SECRET).update(body).digest('base64url')
    expect(verifyRecoveryToken(`${body}.${bareMac}`, SECRET)).toEqual({
      ok: false,
      reason: 'signature',
    })
  })
})

describe('abandoned carts', () => {
  it('ignores carts inside the grace period and lists the quiet ones', async () => {
    const { storeId, variantId } = await seed()
    await quietCart(storeId, variantId, 5, 'fresh@example.in')
    const old = await quietCart(storeId, variantId, 180, 'quiet@example.in')

    const listed = await withStore(app, storeId, (tx) =>
      listAbandoned({ storeId, tx }, { page: 1, perPage: 25 }),
    )
    expect(listed.total).toBe(1)
    expect(listed.items[0]?.id).toBe(old)
    expect(listed.items[0]?.email).toBe('quiet@example.in')
    expect(listed.items[0]?.itemCount).toBe(1)
    expect(listed.items[0]?.subtotalPaise).toBe(100000)
    expect(listed.items[0]?.recovered).toBe(false)
  })

  it('leaves out carts with no contact and carts with no lines', async () => {
    const { storeId, variantId } = await seed()
    const at = new Date(Date.now() - ABANDONED_AFTER_MS - 60_000)
    await withStore(app, storeId, async (tx) => {
      const ctx = { storeId, tx }
      /* No contact. */
      const anon = await createCart(ctx)
      await addToCart(ctx, anon, variantId, 1)
      await tx.update(cart).set({ updatedAt: at }).where(eq(cart.id, anon))
      /* Contact but empty basket. */
      const empty = await createCart(ctx)
      await captureCartContact(ctx, empty, { email: 'empty@example.in' })
      await tx.update(cart).set({ updatedAt: at }).where(eq(cart.id, empty))
    })
    const listed = await withStore(app, storeId, (tx) =>
      listAbandoned({ storeId, tx }, { page: 1, perPage: 25 }),
    )
    expect(listed.total).toBe(0)
  })

  it('counts a converted cart as recovered in the stats', async () => {
    const { storeId, variantId } = await seed()
    const lost = await quietCart(storeId, variantId, 180, 'lost@example.in')
    const won = await quietCart(storeId, variantId, 200, 'won@example.in')
    await withStore(app, storeId, (tx) =>
      tx.update(cart).set({ status: 'converted' }).where(eq(cart.id, won)),
    )
    const stats = await withStore(app, storeId, (tx) => abandonedStats({ storeId, tx }))
    expect(stats.carts).toBe(2)
    expect(stats.recovered).toBe(1)
    expect(stats.recoveryRate).toBeCloseTo(0.5)
    /* Only the basket still lost counts as money left behind. */
    expect(stats.valuePaise).toBe(100000)
    expect(lost).toBeTruthy()
  })

  it('offers a cart for the automatic nudge once, then never again', async () => {
    const { storeId, variantId } = await seed()
    const id = await quietCart(storeId, variantId, 300, 'nudge@example.in')
    const first = await withStore(app, storeId, (tx) =>
      cartsAwaitingRecovery({ storeId, tx }, { afterMs: 4 * 60 * 60_000 }),
    )
    expect(first.map((c) => c.id)).toEqual([id])

    await withStore(app, storeId, (tx) =>
      tx.update(cart).set({ recoverySentAt: new Date() }).where(eq(cart.id, id)),
    )
    const second = await withStore(app, storeId, (tx) =>
      cartsAwaitingRecovery({ storeId, tx }, { afterMs: 4 * 60 * 60_000 }),
    )
    expect(second).toEqual([])
  })
})
