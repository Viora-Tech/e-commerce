import { createDb, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  deleteSavedReport,
  getSavedReport,
  listSavedReports,
  renameSavedReport,
  saveReport,
  updateSavedQuery,
} from '../src/services/saved-reports.service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function newStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  return s?.id as string
}

describe('saved reports', () => {
  it('saves, renames and deletes a report with its range, per store', async () => {
    const one = await newStore('r1')
    const two = await newStore('r2')
    const saved = await withStore(app, one, (tx) =>
      saveReport(
        tx,
        one,
        { name: 'Sales by state', reportSlug: 'sales-by-state', range: { key: '7d' } },
        null,
      ),
    )
    const list = await withStore(app, one, (tx) => listSavedReports(tx))
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      name: 'Sales by state',
      range: { key: '7d' },
      reportTitle: expect.any(String),
    })
    expect(await withStore(app, two, (tx) => listSavedReports(tx))).toHaveLength(0)
    await withStore(app, one, (tx) => renameSavedReport(tx, saved?.id as string, 'States weekly'))
    expect((await withStore(app, one, (tx) => listSavedReports(tx)))[0]?.name).toBe('States weekly')
    await withStore(app, one, (tx) => deleteSavedReport(tx, saved?.id as string))
    expect(await withStore(app, one, (tx) => listSavedReports(tx))).toHaveLength(0)
  })

  it('refuses a report that is not in the catalogue', async () => {
    const one = await newStore('r3')
    await expect(
      withStore(app, one, (tx) =>
        saveReport(tx, one, { name: 'x', reportSlug: 'nope', range: { key: '30d' } }, null),
      ),
    ).rejects.toThrow(/not available/)
  })

  it('saves a custom query with its text, lists it and saves edits over it', async () => {
    const one = await newStore('r4')
    const query = 'FROM sales\n  SHOW orders\n  GROUP BY state'
    const saved = await withStore(app, one, (tx) =>
      saveReport(
        tx,
        one,
        { name: 'Orders by state', reportSlug: 'query', range: { key: '30d' }, query },
        null,
      ),
    )
    const list = await withStore(app, one, (tx) => listSavedReports(tx))
    expect(list[0]).toMatchObject({ reportSlug: 'query', query, reportTitle: 'Custom query' })
    const id = saved?.id as string
    const next = 'FROM sales SHOW net_sales GROUP BY day SINCE -7d UNTIL today'
    await withStore(app, one, (tx) =>
      updateSavedQuery(tx, { id, name: 'Daily sales', query: next, range: { key: '7d' } }),
    )
    expect(await withStore(app, one, (tx) => getSavedReport(tx, id))).toMatchObject({
      name: 'Daily sales',
      query: next,
      range: { key: '7d' },
    })
  })

  it('refuses a custom query that does not parse, and query edits on a catalogue report', async () => {
    const one = await newStore('r5')
    await expect(
      withStore(app, one, (tx) =>
        saveReport(
          tx,
          one,
          { name: 'x', reportSlug: 'query', range: { key: '30d' }, query: 'SELECT 1' },
          null,
        ),
      ),
    ).rejects.toThrow(/line 1/)
    const catalogue = await withStore(app, one, (tx) =>
      saveReport(
        tx,
        one,
        { name: 'States', reportSlug: 'sales-by-state', range: { key: '7d' } },
        null,
      ),
    )
    expect(catalogue?.query).toBeNull()
    await expect(
      withStore(app, one, (tx) =>
        updateSavedQuery(tx, {
          id: catalogue?.id as string,
          name: 'x',
          query: 'FROM sales SHOW orders',
          range: { key: '7d' },
        }),
      ),
    ).rejects.toThrow()
  })
})
