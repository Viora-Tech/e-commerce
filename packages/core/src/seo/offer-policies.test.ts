/** SOURCE OF TRUTH: productOfferPolicies tests — WHAT: the return window and cheapest flat India rate the product structured data reads / WHY: Google merchant listings must quote the store's real shipping and returns */
import { createDb, shippingRate, shippingZone, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { productOfferPolicies } from './offer-policies'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function seedStore(returns: unknown = null) {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'Waimers', returns }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

describe('productOfferPolicies', () => {
  it("reads the store's return window and its cheapest flat India rate", async () => {
    const storeId = await seedStore({ enabled: true, windowDays: 10 })
    const [india] = await owner
      .insert(shippingZone)
      .values({ storeId, name: 'India', stateCodes: [] })
      .returning()
    const [abroad] = await owner
      .insert(shippingZone)
      .values({ storeId, name: 'World', countryCodes: ['AE'] })
      .returning()
    await owner.insert(shippingRate).values([
      {
        storeId,
        zoneId: india?.id as string,
        name: 'Standard',
        pricePaise: 9900,
        minTransitDays: 2,
        maxTransitDays: 5,
        freeAbovePaise: 199_900,
      },
      {
        storeId,
        zoneId: india?.id as string,
        name: 'Express',
        pricePaise: 19_900,
        minTransitDays: 1,
        maxTransitDays: 2,
      },
      // Abroad is cheaper, but it is not an India rate.
      { storeId, zoneId: abroad?.id as string, name: 'Intl', pricePaise: 100 },
    ])
    const facts = await withStore(app, storeId, (tx) => productOfferPolicies(tx, storeId))
    expect(facts).toEqual({
      returns: { enabled: true, windowDays: 10 },
      shipping: { fromPaise: 9900, freeAbovePaise: 199_900, minDays: 1, maxDays: 5 },
    })
  })

  it('has no shipping facts when the store has no India rates', async () => {
    const storeId = await seedStore({ enabled: false })
    const facts = await withStore(app, storeId, (tx) => productOfferPolicies(tx, storeId))
    expect(facts.shipping).toBeNull()
    expect(facts.returns.enabled).toBe(false)
  })
})
