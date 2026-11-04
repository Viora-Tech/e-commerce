import { describe, expect, it } from 'vitest'
import { ImportError } from '../src/service'
import type { ShopifyClient } from '../src/shopify-client'
import { ShopifyError } from '../src/shopify-client'
import { fetchTrafficDays, parseTrafficRows } from '../src/traffic'

const clientAnswering = (answer: () => Promise<unknown>) =>
  ({ query: answer }) as unknown as ShopifyClient

describe('parseTrafficRows', () => {
  it('reads days from the rows Shopify documents', () => {
    expect(
      parseTrafficRows([
        { day: '2026-11-01', sessions: '120', online_store_visitors: '90' },
        { day: '2026-11-02T00:00:00+05:30', sessions: 44, online_store_visitors: 30 },
      ]),
    ).toEqual([
      { day: '2026-11-01', sessions: 120, visitors: 90 },
      { day: '2026-11-02', sessions: 44, visitors: 30 },
    ])
  })

  it('drops days with no visits and rows with no date', () => {
    expect(
      parseTrafficRows([
        { day: '2026-11-01', sessions: '0', online_store_visitors: '0' },
        { day: null, sessions: '5' },
      ]),
    ).toEqual([])
  })

  it('accepts rows sent as a JSON string, and nothing at all', () => {
    expect(parseTrafficRows('[{"day":"2026-11-01","sessions":"3"}]')).toEqual([
      { day: '2026-11-01', sessions: 3, visitors: 0 },
    ])
    expect(parseTrafficRows(null)).toEqual([])
  })
})

describe('fetchTrafficDays', () => {
  it('says what access is missing when Shopify refuses', async () => {
    const client = clientAnswering(() => Promise.reject(new ShopifyError('Access denied', 'scope')))
    await expect(fetchTrafficDays(client)).rejects.toThrow(/read_reports/)
    await expect(fetchTrafficDays(client)).rejects.toBeInstanceOf(ImportError)
  })

  it('passes on the error when Shopify cannot run the report', async () => {
    const client = clientAnswering(() =>
      Promise.resolve({
        shopifyqlQuery: { tableData: null, parseErrors: ["Column 'sessions' not found"] },
      }),
    )
    await expect(fetchTrafficDays(client)).rejects.toThrow(/Column 'sessions' not found/)
  })

  it('reads the days from a good answer', async () => {
    const client = clientAnswering(() =>
      Promise.resolve({
        shopifyqlQuery: {
          tableData: { rows: [{ day: '2026-11-01', sessions: '7', online_store_visitors: '5' }] },
          parseErrors: [],
        },
      }),
    )
    await expect(fetchTrafficDays(client)).resolves.toEqual([
      { day: '2026-11-01', sessions: 7, visitors: 5 },
    ])
  })
})
