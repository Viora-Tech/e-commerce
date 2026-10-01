/** SOURCE OF TRUTH: tests for ./origin.ts — ORIGIN_FALLBACK (location GSTIN, default GSTIN, store address) and the GST split placeOrder charges from it. */
import {
  cart,
  cartLine,
  createDb,
  inventoryLevel,
  location,
  order,
  product,
  type StoreTx,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { placeOrder } from '../order/place-order'
import { FakePaymentProvider } from '../providers/payment'
import { gstinCheckChar } from './gstin'
import { pickTaxOrigin, resolveTaxOrigin } from './origin'
import { addRegistration, cancelRegistration, linkLocationRegistration } from './registrations'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

function gstin(state: string, pan = 'AAACW1234A'): string {
  const first14 = `${state}${pan}1Z`
  return first14 + gstinCheckChar(first14)
}
const PINS: Record<string, string> = { HR: '122001', KA: '560001' }
const HR = gstin('06')
const KA = gstin('29')

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

describe('pickTaxOrigin', () => {
  const hrReg = { id: 'r-hr', gstin: HR }
  const kaReg = { id: 'r-ka', gstin: KA }
  const at = (id: string, grossPaise: number, registration = null as typeof hrReg | null) => ({
    locationId: id,
    locationName: id,
    isDefault: id === 'main',
    grossPaise,
    registration,
  })

  it('bills from the selling location’s GSTIN', () => {
    const o = pickTaxOrigin({
      locations: [at('blr', 500, kaReg)],
      defaultRegistration: hrReg,
      storeState: 'HR',
    })
    expect(o).toMatchObject({
      source: 'location',
      locationId: 'blr',
      gstRegistrationId: 'r-ka',
      gstin: KA,
      stateCode: 'KA',
      stateName: 'Karnataka',
    })
  })

  it('falls back to the default GSTIN, then to the store address', () => {
    expect(
      pickTaxOrigin({ locations: [at('blr', 500)], defaultRegistration: hrReg, storeState: 'KA' }),
    ).toMatchObject({ source: 'default_registration', locationId: 'blr', stateCode: 'HR' })
    expect(
      pickTaxOrigin({ locations: [], defaultRegistration: null, storeState: 'Maharashtra' }),
    ).toMatchObject({ source: 'store_address', gstin: null, stateCode: 'MH' })
    expect(
      pickTaxOrigin({ locations: [], defaultRegistration: null, storeState: 'Atlantis' }),
    ).toMatchObject({ source: 'store_address', stateCode: null, stateName: null })
  })

  it('takes the location holding the most value; the default location wins a tie', () => {
    const mixed = [at('main', 300, hrReg), at('blr', 700, kaReg)]
    expect(
      pickTaxOrigin({ locations: mixed, defaultRegistration: hrReg, storeState: null }).locationId,
    ).toBe('blr')
    const tie = [at('blr', 500, kaReg), at('main', 500, hrReg)]
    expect(
      pickTaxOrigin({ locations: tie, defaultRegistration: hrReg, storeState: null }).locationId,
    ).toBe('main')
  })
})

type Seeded = { storeId: string; variantId: string; mainId: string; blrId: string }

/** A Haryana store with a Bengaluru warehouse; the variant sells from `sellsFrom`. */
async function seedStore(sellsFrom: 'main' | 'blr' = 'main'): Promise<Seeded> {
  const [s] = await owner
    .insert(store)
    .values({
      slug: 'w',
      name: 'Waimers',
      address: { line1: '14 Sector 29', city: 'Gurugram', state: 'HR', pincode: '122001' },
    })
    .returning()
  if (!s) throw new Error('seed')
  const [main] = await owner
    .insert(location)
    .values({
      storeId: s.id,
      name: 'Gurugram',
      stateCode: 'HR',
      isDefault: true,
      fulfilsOnlineOrders: sellsFrom === 'main',
    })
    .returning()
  const [blr] = await owner
    .insert(location)
    .values({
      storeId: s.id,
      name: 'Bengaluru',
      stateCode: 'KA',
      fulfilsOnlineOrders: sellsFrom === 'blr',
    })
    .returning()
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mouse', title: 'Mouse', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'Black', pricePaise: 118_000 })
    .returning()
  await owner.insert(inventoryLevel).values({
    storeId: s.id,
    variantId: v?.id as string,
    locationId: sellsFrom === 'main' ? main?.id : blr?.id,
    onHand: 10,
  })
  return {
    storeId: s.id,
    variantId: v?.id as string,
    mainId: main?.id as string,
    blrId: blr?.id as string,
  }
}

async function registerBoth(seed: Seeded) {
  const { storeId } = seed
  const hr = await inStore(storeId, (tx) => addRegistration(tx, storeId, { gstin: HR }))
  const ka = await inStore(storeId, (tx) => addRegistration(tx, storeId, { gstin: KA }))
  await inStore(storeId, (tx) =>
    linkLocationRegistration(tx, storeId, { locationId: seed.mainId, gstRegistrationId: hr.id }),
  )
  await inStore(storeId, (tx) =>
    linkLocationRegistration(tx, storeId, { locationId: seed.blrId, gstRegistrationId: ka.id }),
  )
  return { hr: hr.id, ka: ka.id }
}

/** Place a one-line order shipped to `stateCode` and read it back. */
async function orderTo(seed: Seeded, stateCode: string) {
  const [c] = await owner.insert(cart).values({ storeId: seed.storeId }).returning()
  await owner.insert(cartLine).values({
    storeId: seed.storeId,
    cartId: c?.id as string,
    variantId: seed.variantId,
    quantity: 1,
    unitPricePaise: 118_000,
  })
  const placed = await inStore(seed.storeId, (tx) =>
    placeOrder(
      { storeId: seed.storeId, tx },
      {
        cartId: c?.id as string,
        paymentProvider: new FakePaymentProvider(),
        checkout: {
          email: 'a@example.com',
          phone: '9820012345',
          name: 'Aarav',
          address: { line1: '1 Road', city: 'City', stateCode, pincode: PINS[stateCode] ?? '' },
        },
      },
    ),
  )
  const [o] = await owner.select().from(order).where(eq(order.id, placed.orderId))
  if (!o) throw new Error('order missing')
  return { ...o, tax: o.taxBreakdown as { cgstPaise: number; igstPaise: number } }
}

describe('placeOrder charges GST from the tax origin', () => {
  it('a Karnataka warehouse bills Karnataka shoppers CGST + SGST and others IGST', async () => {
    const seed = await seedStore('blr')
    const { ka } = await registerBoth(seed)
    const local = await orderTo(seed, 'KA')
    expect(local.gstRegistrationId).toBe(ka)
    expect(local.taxOrigin).toMatchObject({ source: 'location', gstin: KA, stateCode: 'KA' })
    expect(local.tax).toMatchObject({ igstPaise: 0, cgstPaise: 9_000 })
    const far = await orderTo(seed, 'HR')
    expect(far.tax).toMatchObject({ igstPaise: 18_000, cgstPaise: 0 })
    // Prices include GST: the shopper pays the same wherever it ships from.
    expect([local.totalPaise, far.totalPaise]).toEqual([118_000, 118_000])
    expect([local.taxPaise, far.taxPaise]).toEqual([18_000, 18_000])
  })

  it('an unlinked location bills from the default GSTIN', async () => {
    const seed = await seedStore('blr')
    const hr = await inStore(seed.storeId, (tx) => addRegistration(tx, seed.storeId, { gstin: HR }))
    const o = await orderTo(seed, 'HR')
    expect(o.gstRegistrationId).toBe(hr.id)
    expect(o.taxOrigin).toMatchObject({
      source: 'default_registration',
      locationId: seed.blrId,
      stateCode: 'HR',
    })
    expect(o.tax.igstPaise).toBe(0)
  })

  it('a cancelled location GSTIN falls back to the default one', async () => {
    const seed = await seedStore('blr')
    const { hr, ka } = await registerBoth(seed)
    await inStore(seed.storeId, (tx) => cancelRegistration(tx, seed.storeId, ka))
    const o = await orderTo(seed, 'KA')
    expect(o.gstRegistrationId).toBe(hr)
    expect(o.tax.igstPaise).toBe(18_000)
  })

  it('without any GSTIN, the store address decides, as before', async () => {
    const seed = await seedStore('blr')
    const o = await orderTo(seed, 'HR')
    expect(o.gstRegistrationId).toBeNull()
    expect(o.taxOrigin).toMatchObject({ source: 'store_address', stateCode: 'HR' })
    expect(o.tax.igstPaise).toBe(0)
    expect((await orderTo(seed, 'KA')).tax.igstPaise).toBe(18_000)
  })

  it('resolveTaxOrigin ignores lines with no stock row and weighs the rest', async () => {
    const seed = await seedStore('main')
    const { hr } = await registerBoth(seed)
    const origin = await inStore(seed.storeId, (tx) =>
      resolveTaxOrigin(tx, {
        lines: [
          { variantId: seed.variantId, grossPaise: 100 },
          { variantId: '0199a000-0000-7000-8000-000000000001', grossPaise: 900 },
        ],
        storeState: 'KA',
      }),
    )
    expect(origin).toMatchObject({
      source: 'location',
      locationId: seed.mainId,
      gstRegistrationId: hr,
    })
  })
})
