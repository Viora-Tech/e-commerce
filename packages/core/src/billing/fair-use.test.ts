/** SOURCE OF TRUTH: fair-use visit tests — WHAT: when a store gets the two-months-over notice / WHY: a soft limit must notice once and never block */
import { createDb, marketingSession, storePlan } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { seedPaidPeriod, seedStore } from '../testing/usage-seed'
import { overFairUse, runFairUseCheck } from './fair-use'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** `n` sessions started on `day` (UTC midday, so inside the same IST day). */
async function seedSessions(storeId: string, day: string, n: number) {
  const rows = Array.from({ length: n }, (_, i) => ({
    storeId,
    visitorId: `v${i}`,
    channel: 'direct',
    startedAt: new Date(`${day}T06:00:00Z`),
  }))
  for (let i = 0; i < rows.length; i += 5_000)
    await owner.insert(marketingSession).values(rows.slice(i, i + 5_000))
}

const SEP = new Date('2026-08-31T18:30:00Z')
const DEC = new Date('2026-11-30T18:30:00Z')
const NOV_RUN = new Date('2026-10-31T19:00:00Z')

describe('overFairUse', () => {
  it('needs both months over the plan, and never applies to Scale', () => {
    expect(overFairUse('starter', [25_001, 30_000])).toBe(true)
    expect(overFairUse('starter', [25_001, 20_000])).toBe(false)
    expect(overFairUse('scale', [9e9, 9e9])).toBe(false)
  })
})

describe('runFairUseCheck', () => {
  it('notices a Starter store over 25,000 visits two months running, once', async () => {
    const id = await seedStore(owner, 'asha')
    await seedPaidPeriod(owner, id, 'starter', SEP, DEC)
    await seedSessions(id, '2026-09-10', 25_001)
    await seedSessions(id, '2026-10-10', 25_001)
    expect(await runFairUseCheck(app, NOV_RUN)).toEqual({ checked: 1, noticed: 1 })
    expect(await runFairUseCheck(app, NOV_RUN)).toEqual({ checked: 1, noticed: 0 })
    const [plan] = await owner.select().from(storePlan)
    expect(plan).toMatchObject({ fairUseNoticeMonth: '2026-10', status: 'active' })
  })

  it('ignores a store over for one month only', async () => {
    const id = await seedStore(owner, 'asha')
    await seedPaidPeriod(owner, id, 'starter', SEP, DEC)
    await seedSessions(id, '2026-10-10', 30_000)
    expect(await runFairUseCheck(app, NOV_RUN)).toEqual({ checked: 1, noticed: 0 })
  })
})
