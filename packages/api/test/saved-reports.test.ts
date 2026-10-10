import { createDb, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  deleteSavedReport,
  listSavedReports,
  renameSavedReport,
  saveReport,
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
})
