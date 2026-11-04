import { createDb, importedTrafficDay, marketingSession, type StoreTx, store } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { countSessions, totalSessions } from '../src/services/sessions'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const tx = owner as unknown as StoreTx

/** 12:00 in India on a day, so a date never slides across midnight. */
const noon = (day: string) => new Date(`${day}T06:30:00.000Z`)

const window = {
  from: new Date('2026-09-30T18:30:00.000Z'),
  to: new Date('2026-10-02T18:30:00.000Z'),
  days: ['2026-10-01', '2026-10-02'],
}

describe('imported traffic in session counts', () => {
  beforeEach(async () => {
    await resetDb(owner)
    const [s] = await owner
      .insert(store)
      .values({ slug: 'traffic', name: 'Traffic', organizationId: 'org-traffic' })
      .returning()
    const storeId = s?.id as string
    await owner.insert(importedTrafficDay).values([
      { storeId, day: '2026-09-30', sessions: 1000, visitors: 900 },
      { storeId, day: '2026-10-01', sessions: 100, visitors: 80 },
      { storeId, day: '2026-10-02', sessions: 50, visitors: 40 },
      { storeId, day: '2026-10-03', sessions: 2000, visitors: 1800 },
    ])
    await owner
      .insert(marketingSession)
      .values({ storeId, visitorId: 'v1', channel: 'direct', startedAt: noon('2026-10-02') })
  })

  afterAll(async () => {
    await owner.$client.end()
  })

  it('adds imported days to the daily series, only inside the window', async () => {
    await expect(countSessions(tx, window, false)).resolves.toEqual([100, 51])
  })

  it('counts each imported day once in the total', async () => {
    await expect(totalSessions(tx, window.from, window.to)).resolves.toBe(151)
  })

  it('leaves the hourly view to sessions counted here', async () => {
    const hours = await countSessions(tx, window, true)
    expect(hours.reduce((sum, n) => sum + n, 0)).toBe(1)
  })
})
