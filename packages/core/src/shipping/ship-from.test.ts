/** SOURCE OF TRUTH: tests for ./ship-from.ts — per-location courier pickup, PICKUP_NEEDS_ADDRESS and the Settings › Shipping fallback. */
import {
  address,
  createDb,
  location,
  type OrderTaxOrigin,
  order,
  orderLine,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { FakeShippingProvider } from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { GstRegistrationError } from '../tax/registrations'
import { parseShippingSettings } from './settings'
import { setLocationCourierPickup, shipFromFor } from './ship-from'
import { createShipmentForOrder } from './shipments'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const SHIPPING = {
  enabled: ['fake'],
  policy: {
    originPincode: '131028',
    warehouse: { name: 'Waimers HQ', line1: 'Plot 4', city: 'Sonipat', state: 'HR', phone: '9' },
  },
}

async function seed() {
  const [s] = await owner
    .insert(store)
    .values({ slug: 'w', name: 'Waimers', shipping: SHIPPING })
    .returning()
  if (!s) throw new Error('seed')
  const [main] = await owner
    .insert(location)
    .values({ storeId: s.id, name: 'Gurugram', isDefault: true, fulfilsOnlineOrders: true })
    .returning()
  const [blr] = await owner
    .insert(location)
    .values({
      storeId: s.id,
      name: 'Bengaluru',
      line1: '5 Whitefield Road',
      city: 'Bengaluru',
      stateCode: 'KA',
      pincode: '560066',
      phone: '8888888888',
    })
    .returning()
  return { storeId: s.id, mainId: main?.id as string, blrId: blr?.id as string }
}

const originAt = (locationId: string | null): OrderTaxOrigin => ({
  source: 'store_address',
  locationId,
  locationName: null,
  gstRegistrationId: null,
  gstin: null,
  stateCode: null,
  stateName: null,
})

const settings = parseShippingSettings(SHIPPING)

describe('courier pickup per location', () => {
  it('uses Settings › Shipping until a location turns pickup on', async () => {
    const { storeId, blrId } = await seed()
    const from = await withStore(app, storeId, (tx) =>
      shipFromFor(tx, { taxOrigin: originAt(blrId), settings, storeName: 'Waimers' }),
    )
    expect(from).toEqual({
      address: {
        name: 'Waimers HQ',
        line1: 'Plot 4',
        line2: undefined,
        city: 'Sonipat',
        state: 'HR',
        pincode: '131028',
        country: 'IN',
        phone: '9',
      },
      pickupLocationName: null,
      locationId: null,
    })
  })

  it('collects from the location the order sells from, under its courier pickup name', async () => {
    const { storeId, blrId } = await seed()
    await withStore(app, storeId, (tx) =>
      setLocationCourierPickup(tx, storeId, {
        locationId: blrId,
        pickup: { pickupName: 'BLR-WH', contactName: '', phone: '' },
      }),
    )
    const from = await withStore(app, storeId, (tx) =>
      shipFromFor(tx, { taxOrigin: originAt(blrId), settings, storeName: 'Waimers' }),
    )
    expect(from).toMatchObject({
      pickupLocationName: 'BLR-WH',
      locationId: blrId,
      address: { name: 'Bengaluru', city: 'Bengaluru', state: 'KA', pincode: '560066' },
    })
    expect(from.address.phone).toBe('8888888888')
  })

  it("a parcel's own location wins over the order's tax origin", async () => {
    const { storeId, mainId, blrId } = await seed()
    await withStore(app, storeId, (tx) =>
      setLocationCourierPickup(tx, storeId, {
        locationId: blrId,
        pickup: { pickupName: 'BLR-WH', contactName: '', phone: '' },
      }),
    )
    const from = await withStore(app, storeId, (tx) =>
      shipFromFor(tx, {
        taxOrigin: originAt(mainId),
        locationId: blrId,
        settings,
        storeName: 'Waimers',
      }),
    )
    expect(from).toMatchObject({ pickupLocationName: 'BLR-WH', locationId: blrId })
  })

  it('refuses pickup at a location without a full address, and can be turned off', async () => {
    const { storeId, mainId, blrId } = await seed()
    const err = await withStore(app, storeId, (tx) =>
      setLocationCourierPickup(tx, storeId, {
        locationId: mainId,
        pickup: { pickupName: 'GGN', contactName: '', phone: '' },
      }),
    ).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(GstRegistrationError)
    expect((err as GstRegistrationError).code).toBe('ADDRESS_INCOMPLETE')
    await withStore(app, storeId, async (tx) => {
      await setLocationCourierPickup(tx, storeId, {
        locationId: blrId,
        pickup: { pickupName: 'BLR', contactName: 'Ravi', phone: '7777777777' },
      })
      await setLocationCourierPickup(tx, storeId, { locationId: blrId, pickup: null })
    })
    const [row] = await owner.select().from(location).where(eq(location.id, blrId))
    expect(row?.courierPickup).toBeNull()
  })

  it('books an older order (no tax origin) from the default location when it has pickup on', async () => {
    const { storeId, mainId } = await seed()
    await owner
      .update(location)
      .set({
        line1: '14 Sector 29',
        city: 'Gurugram',
        stateCode: 'HR',
        pincode: '122001',
        courierPickup: { pickupName: 'GGN-WH', contactName: 'Store team', phone: '9111111111' },
      })
      .where(eq(location.id, mainId))
    const [a] = await owner
      .insert(address)
      .values({
        storeId,
        name: 'Asha',
        line1: '12 MG Road',
        city: 'Bengaluru',
        stateCode: 'KA',
        pincode: '560001',
        phone: '9999999999',
      })
      .returning()
    const [o] = await owner
      .insert(order)
      .values({
        storeId,
        number: 7,
        status: 'open',
        subtotalPaise: 1000,
        totalPaise: 1000,
        paymentMethod: 'razorpay',
        shippingAddressId: a?.id,
      })
      .returning()
    const [p] = await owner
      .insert(product)
      .values({ storeId, handle: 'p', title: 'Pad', status: 'active' })
      .returning()
    const [v] = await owner
      .insert(variant)
      .values({ storeId, productId: p?.id as string, title: 'Default', pricePaise: 1000 })
      .returning()
    await owner.insert(orderLine).values({
      storeId,
      orderId: o?.id as string,
      variantId: v?.id as string,
      title: 'Pad',
      variantTitle: 'Default',
      quantity: 1,
      unitPricePaise: 1000,
    })
    const captured: unknown[] = []
    const spy = Object.assign(new FakeShippingProvider(), {
      createShipment: async (input: unknown) => {
        captured.push(input)
        return { waybill: 'WB1', providerRef: 'WB1', labelUrl: 'https://l' }
      },
    })
    await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, spy, o?.id as string),
    )
    expect(captured[0]).toMatchObject({
      pickupLocationName: 'GGN-WH',
      from: { name: 'Store team', pincode: '122001', state: 'HR', phone: '9111111111' },
    })
  })
})

describe('Settings › Shipping with no street', () => {
  const PIN_ONLY = { enabled: ['fake'], policy: { originPincode: '131001', warehouse: {} } }

  async function seedPinOnly(addressPin: string) {
    const [s] = await owner
      .insert(store)
      .values({
        slug: 'p',
        name: 'Waimers',
        shipping: PIN_ONLY,
        contactPhone: '+919000000001',
        address: {
          line1: '12 Test Street',
          line2: 'Sector 1',
          city: 'Sonipat',
          state: 'Haryana',
          pincode: addressPin,
          country: 'IN',
        },
      })
      .returning()
    if (!s) throw new Error('seed')
    return s.id
  }

  it("sends the store's business address instead of a blank one", async () => {
    const storeId = await seedPinOnly('131001')
    const from = await withStore(app, storeId, (tx) =>
      shipFromFor(tx, {
        taxOrigin: null,
        storeAddress: true,
        settings: parseShippingSettings(PIN_ONLY),
        storeName: 'Waimers',
      }),
    )
    expect(from.address).toMatchObject({
      name: 'Waimers',
      line1: '12 Test Street',
      city: 'Sonipat',
      state: 'HR',
      pincode: '131001',
      phone: '+919000000001',
    })
  })

  it('never borrows an address from another PIN code', async () => {
    const storeId = await seedPinOnly('110001')
    const from = await withStore(app, storeId, (tx) =>
      shipFromFor(tx, {
        taxOrigin: null,
        storeAddress: true,
        settings: parseShippingSettings(PIN_ONLY),
        storeName: 'Waimers',
      }),
    )
    expect(from.address.line1).toBe('')
    expect(from.address.pincode).toBe('131001')
  })
})
