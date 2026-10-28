/** SOURCE OF TRUTH: refreshExchangeRates, parseEcbDaily, rupeeRates, latestRupeeRates, storeMarketPricing, FX_RATES_QUEUE, FX_RATES_SCHEDULE
 * WHAT:  The daily reference rates markets convert with: the European Central Bank's euro
 *        reference rates (free, no key, published working days around 16:00 CET) turned into
 *        units per rupee and kept in `exchange_rate` (platform-wide), plus the currencies fixed
 *        to the US dollar (Gulf) or to the rupee (Nepal), which the ECB does not publish.
 *        `storeMarketPricing` gives each of a store's markets its `MarketPricing`.
 * WHY:   A market without a fixed rate (Settings → Markets) converts at the latest reference
 *        rate (`marketPricing`); one job for every store, read from the database per request.
 *        KWD, LKR and BDT have no free official rate here: a market in one of them needs a
 *        fixed rate until a source is added.
 */
import { type Db, exchangeRate, market, type StoreTx } from '@commerce/db'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { type MarketPricing, marketPricing } from './presentment'

/** The ECB's latest euro reference rates (XML, about 30 currencies, INR among them). */
const ECB_DAILY_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'

/** BullMQ queue of the daily rates job (braces keep its keys on one slot). */
export const FX_RATES_QUEUE = '{fx}-rates'
/** Every day at 21:30 India time: after the ECB publishes (16:00 CET), summer and winter. */
export const FX_RATES_SCHEDULE = { pattern: '30 21 * * *', tz: 'Asia/Kolkata' } as const

/** Currencies their central banks fix to the US dollar: units per dollar. */
const USD_PEGS: Readonly<Record<string, number>> = {
  AED: 3.6725,
  SAR: 3.75,
  QAR: 3.64,
  OMR: 0.3845,
  BHD: 0.376,
}
/** Nepal's rupee is fixed to ours: 1.6 per rupee. */
const INR_PEGS: Readonly<Record<string, number>> = { NPR: 1.6 }

export type EcbDaily = { asOf: string; perEuro: Map<string, number> }

/** The day and the units per euro from the ECB's daily XML; null when it is not that file. */
export function parseEcbDaily(xml: string): EcbDaily | null {
  const asOf = /<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml)?.[1]
  if (!asOf) return null
  const perEuro = new Map<string, number>()
  for (const m of xml.matchAll(/<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g)) {
    const rate = Number(m[2])
    if (m[1] && rate > 0) perEuro.set(m[1], rate)
  }
  return perEuro.size > 0 ? { asOf, perEuro } : null
}

/**
 * Units of each currency per rupee, from the units per euro: every ECB currency and the euro
 * itself, then the dollar-pegged ones through the dollar, then the rupee-pegged ones. Empty
 * when the ECB file has no INR (nothing can be converted then).
 */
export function rupeeRates(perEuro: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>()
  const rupeesPerEuro = perEuro.get('INR')
  if (!rupeesPerEuro) return out
  out.set('EUR', 1 / rupeesPerEuro)
  for (const [code, rate] of perEuro) if (code !== 'INR') out.set(code, rate / rupeesPerEuro)
  const usd = out.get('USD')
  if (usd) for (const [code, peg] of Object.entries(USD_PEGS)) out.set(code, usd * peg)
  for (const [code, peg] of Object.entries(INR_PEGS)) out.set(code, peg)
  return out
}

export type RefreshOutcome = { asOf: string; currencies: number } | { problem: string }

/**
 * Reads the ECB's daily file and keeps its rates as units per rupee for its date (`ecb`). A
 * day already kept is left as it is, so running twice (or on a holiday, when the file still
 * carries the last working day) changes nothing.
 */
export async function refreshExchangeRates(
  db: Db,
  deps: { fetch?: typeof fetch } = {},
): Promise<RefreshOutcome> {
  const get = deps.fetch ?? fetch
  let xml: string
  try {
    const res = await get(ECB_DAILY_URL, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return { problem: `ECB answered ${res.status}` }
    xml = await res.text()
  } catch (e) {
    return { problem: `ECB unreachable: ${e instanceof Error ? e.message : String(e)}` }
  }
  const daily = parseEcbDaily(xml)
  if (!daily) return { problem: 'ECB file had no rates' }
  const rates = rupeeRates(daily.perEuro)
  if (rates.size === 0) return { problem: 'ECB file had no INR rate' }
  await db
    .insert(exchangeRate)
    .values(
      [...rates].map(([quote, rate]) => ({
        base: 'INR',
        quote,
        rate: rate.toFixed(8),
        asOf: daily.asOf,
        source: 'ecb' as const,
      })),
    )
    .onConflictDoNothing()
  return { asOf: daily.asOf, currencies: rates.size }
}

/** The latest reference rate per currency (units per rupee), for those asked. */
export async function latestRupeeRates(
  tx: Db | StoreTx,
  currencies: readonly string[],
): Promise<Map<string, number>> {
  const wanted = [...new Set(currencies)].filter((c) => c !== 'INR')
  if (wanted.length === 0) return new Map()
  const rows = await tx
    .selectDistinctOn([exchangeRate.quote], { quote: exchangeRate.quote, rate: exchangeRate.rate })
    .from(exchangeRate)
    .where(and(eq(exchangeRate.base, 'INR'), inArray(exchangeRate.quote, wanted)))
    .orderBy(exchangeRate.quote, desc(exchangeRate.asOf))
  return new Map(rows.map((r) => [r.quote, Number(r.rate)]))
}

/**
 * Each of the store's markets' pricing, by market id (read under the store's RLS). A market
 * with no fixed rate and no reference rate yet maps to null: its shoppers see rupees.
 */
export async function storeMarketPricing(tx: StoreTx): Promise<Map<string, MarketPricing | null>> {
  const rows = await tx
    .select({
      id: market.id,
      currency: market.currency,
      manualRate: market.manualRate,
      priceAdjustmentBp: market.priceAdjustmentBp,
      rounding: market.rounding,
    })
    .from(market)
  const rates = await latestRupeeRates(
    tx,
    rows.filter((r) => r.manualRate === null).map((r) => r.currency),
  )
  return new Map(rows.map((r) => [r.id, marketPricing(r, rates.get(r.currency) ?? null)]))
}
