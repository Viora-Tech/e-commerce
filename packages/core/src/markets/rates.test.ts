/** SOURCE OF TRUTH: exchange rate tests — WHAT: the ECB file read, euro rates turned into rupee rates with the pegs, the daily refresh kept once per day, the latest rate per currency and each market's pricing / WHY: markets without a fixed rate convert with these */
import { createDb, exchangeRate, market, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  latestRupeeRates,
  parseEcbDaily,
  refreshExchangeRates,
  rupeeRates,
  storeMarketPricing,
} from './rates'
import { createMarket } from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const ECB = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <gesmes:subject>Reference rates</gesmes:subject>
  <Cube>
    <Cube time='2026-10-28'>
      <Cube currency='USD' rate='1.1000'/>
      <Cube currency='JPY' rate='165.00'/>
      <Cube currency='GBP' rate='0.8500'/>
      <Cube currency='INR' rate='92.000'/>
    </Cube>
  </Cube>
</gesmes:Envelope>`

const fakeFetch = (body: string, status = 200) =>
  (async () => new Response(body, { status })) as unknown as typeof fetch

describe('ECB rates', () => {
  it('reads the day and the rates per euro', () => {
    const daily = parseEcbDaily(ECB)
    expect(daily?.asOf).toBe('2026-10-28')
    expect(daily?.perEuro.get('INR')).toBe(92)
    expect(daily?.perEuro.size).toBe(4)
    expect(parseEcbDaily('<html>maintenance</html>')).toBeNull()
  })

  it('turns them into units per rupee, with the pegged currencies', () => {
    const rates = rupeeRates(parseEcbDaily(ECB)?.perEuro ?? new Map())
    expect(rates.get('USD')).toBeCloseTo(1.1 / 92, 10)
    expect(rates.get('EUR')).toBeCloseTo(1 / 92, 10)
    // Dirham fixed at 3.6725 per dollar.
    expect(rates.get('AED')).toBeCloseTo((1.1 / 92) * 3.6725, 10)
    expect(rates.get('NPR')).toBe(1.6)
    expect(rates.has('INR')).toBe(false)
    expect(rupeeRates(new Map([['USD', 1.1]])).size).toBe(0)
  })

  it('keeps one set per day, so a second run changes nothing', async () => {
    expect(await refreshExchangeRates(owner, { fetch: fakeFetch(ECB) })).toEqual({
      asOf: '2026-10-28',
      currencies: 10,
    })
    await refreshExchangeRates(owner, { fetch: fakeFetch(ECB) })
    const usd = await owner
      .select()
      .from(exchangeRate)
      .where(and(eq(exchangeRate.quote, 'USD'), eq(exchangeRate.asOf, '2026-10-28')))
    expect(usd).toHaveLength(1)
    expect(usd[0]?.source).toBe('ecb')
  })

  it('reports a failed download instead of throwing', async () => {
    expect(await refreshExchangeRates(owner, { fetch: fakeFetch('down', 503) })).toEqual({
      problem: 'ECB answered 503',
    })
    expect(await refreshExchangeRates(owner, { fetch: fakeFetch('<x/>') })).toEqual({
      problem: 'ECB file had no rates',
    })
  })

  it('reads the latest day per currency', async () => {
    await owner.insert(exchangeRate).values([
      { quote: 'USD', rate: '0.01100000', asOf: '2026-10-27', source: 'ecb' },
      { quote: 'USD', rate: '0.01200000', asOf: '2026-10-28', source: 'ecb' },
      { quote: 'GBP', rate: '0.00900000', asOf: '2026-10-26', source: 'ecb' },
    ])
    const rates = await latestRupeeRates(owner, ['USD', 'GBP', 'INR', 'AED'])
    expect(Object.fromEntries(rates)).toEqual({ USD: 0.012, GBP: 0.009 })
  })
})

describe('storeMarketPricing', () => {
  it('gives each market its rate: fixed, reference, or none yet', async () => {
    const [s] = await owner.insert(store).values({ slug: 'waimers', name: 'Waimers' }).returning()
    const storeId = s?.id as string
    await owner
      .insert(exchangeRate)
      .values({ quote: 'USD', rate: '0.01200000', asOf: '2026-10-28', source: 'ecb' })
    const pricing = await withStore(app, storeId, async (tx) => {
      const ctx = { storeId, tx }
      await createMarket(ctx, { name: 'USA', countries: ['US'], currency: 'USD' })
      await createMarket(ctx, { name: 'Gulf', countries: ['AE'], currency: 'AED' })
      await createMarket(ctx, { name: 'UK', countries: ['GB'], currency: 'GBP' })
      await tx.update(market).set({ manualRate: '0.00950000' }).where(eq(market.handle, 'uk'))
      const byId = await storeMarketPricing(tx)
      const rows = await tx.select({ id: market.id, handle: market.handle }).from(market)
      return Object.fromEntries(rows.map((r) => [r.handle, byId.get(r.id)]))
    })
    expect(pricing.india).toEqual({ currency: 'INR', rate: 1, adjustmentBp: 0, rounding: 'none' })
    expect(pricing.usa?.rate).toBe(0.012)
    expect(pricing.uk?.rate).toBe(0.0095)
    // No AED reference rate stored in this test, and no fixed rate: rupees.
    expect(pricing.gulf).toBeNull()
  })
})
