/** SOURCE OF TRUTH: Shopify's traffic history — WHAT: reads daily sessions and visitors through `shopifyqlQuery` and saves them per day / WHY: reports read imported orders from day one, but sessions and conversion would start from zero after a move, and this history stays in Shopify's reports otherwise. Shopify only gives totals, never single visits, so it is a table of days, apart from `marketing_session` */
import { importedTrafficDay, type StoreTx } from '@commerce/db'
import { clientFor } from './connection'
import { ImportError } from './service'
import { type ShopifyClient, ShopifyError } from './shopify-client'

/** Two years of days: ShopifyQL answers a table of up to 1,000 rows by default. */
const TRAFFIC_DAYS = 730

/** Real shoppers only, without bots. Yesterday is the last whole day. */
export const TRAFFIC_QUERY = `FROM sessions SHOW sessions, online_store_visitors WHERE human_or_bot_session = 'human' TIMESERIES day SINCE -${TRAFFIC_DAYS}d UNTIL yesterday ORDER BY day ASC`

const GRAPHQL = `query TrafficHistory($query: String!) {
  shopifyqlQuery(query: $query) { tableData { rows } parseErrors }
}`

const COST = 10
const WRITE_BATCH = 500

const NO_ACCESS =
  'Shopify refused the traffic report. The app needs read_reports and Level 2 customer data access, then reconnect it.'
const NOT_CONNECTED = 'Connect your Shopify store first'

type TrafficAnswer = {
  shopifyqlQuery: { tableData: { rows: unknown } | null; parseErrors: string[] }
}

export type TrafficDay = { day: string; sessions: number; visitors: number }

export type TrafficImport = {
  days: number
  sessions: number
  from: string | null
  to: string | null
}

const count = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

/** Shopify's rows as days. A day nobody visited holds nothing worth saving. */
export function parseTrafficRows(rows: unknown): TrafficDay[] {
  const list = typeof rows === 'string' ? (JSON.parse(rows) as unknown) : rows
  if (!Array.isArray(list)) return []
  const days: TrafficDay[] = []
  for (const row of list as Record<string, unknown>[]) {
    const day = /^\d{4}-\d{2}-\d{2}/.exec(String(row.day ?? ''))?.[0]
    const sessions = count(row.sessions)
    if (day && sessions > 0) {
      days.push({ day, sessions, visitors: count(row.online_store_visitors) })
    }
  }
  return days
}

/** Every day Shopify has traffic for, in the window. */
export async function fetchTrafficDays(client: ShopifyClient): Promise<TrafficDay[]> {
  const data = await client
    .query<TrafficAnswer>(GRAPHQL, { query: TRAFFIC_QUERY }, COST)
    .catch((err: unknown) => {
      if (err instanceof ShopifyError && err.kind === 'scope') throw new ImportError(NO_ACCESS)
      throw err
    })
  const { tableData, parseErrors } = data.shopifyqlQuery
  const problem = parseErrors[0]
  if (problem) throw new ImportError(`Shopify could not read the traffic report: ${problem}`)
  return parseTrafficRows(tableData?.rows)
}

/** Save Shopify's days. Running it again replaces them all, so no old day stays behind. */
export async function importTraffic(
  tx: StoreTx,
  storeId: string,
  secret: string,
): Promise<TrafficImport> {
  const client = await clientFor(tx, secret)
  if (!client) throw new ImportError(NOT_CONNECTED)
  const days = await fetchTrafficDays(client)
  await tx.delete(importedTrafficDay)
  for (let i = 0; i < days.length; i += WRITE_BATCH) {
    await tx
      .insert(importedTrafficDay)
      .values(days.slice(i, i + WRITE_BATCH).map((d) => ({ ...d, storeId })))
  }
  return {
    days: days.length,
    sessions: days.reduce((sum, d) => sum + d.sessions, 0),
    from: days[0]?.day ?? null,
    to: days.at(-1)?.day ?? null,
  }
}
