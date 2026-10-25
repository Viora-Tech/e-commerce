import { createDb, media, outboxEvent, type StoreTx, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { applyAsAffiliate, recordAffiliateClick, setAffiliateStatus } from '../src/affiliates'
import { archiveCreative, listCreatives, saveCreative } from '../src/creatives'
import { createProgram, defaultProgram } from '../src/programs'
import { affiliateClickDay } from '../src/schema'
import {
  type AffiliateSettings,
  cleanAnswers,
  conversionPercent,
  defaultAffiliateSettings,
  defaultProgramRules,
  type SignupField,
} from '../src/settings'
import { affiliateTrend, ledgerCsv, topProducts } from '../src/stats'

/*
 * The last v1.1 pieces: signup answers kept to the form, the applied and rejected events (the
 * merchant's alert, the rejection email), clicks per day for trends, creatives per program and
 * the ledger CSV.
 */

describe('signup answers', () => {
  const form: SignupField[] = [
    { id: 'followers', label: 'Followers', kind: 'number', required: true, options: [] },
    {
      id: 'niche',
      label: 'Niche',
      kind: 'select',
      required: false,
      options: ['Beauty', 'Fashion'],
    },
    { id: 'gst', label: 'GST', kind: 'checkbox', required: false, options: [] },
  ]

  it('keeps only valid answers and names the first missing required one', () => {
    expect(
      cleanAnswers(form, { followers: ' 4000 ', niche: 'Food', gst: true, extra: 'x' }),
    ).toEqual({
      answers: { followers: '4000', gst: 'yes' },
      missing: null,
    })
    expect(cleanAnswers(form, { followers: 'many' }).missing).toBe('followers')
  })

  it('works out conversion', () => {
    expect(conversionPercent(3, 40)).toBe(7.5)
    expect(conversionPercent(3, 0)).toBeNull()
  })
})

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-secret-test-secret-test-secret-00'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const manual: AffiliateSettings = { ...defaultAffiliateSettings, approval: 'manual' }
const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

async function seed() {
  const slug = `s-${Math.random().toString(36).slice(2)}`
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, apps: { installed: ['affiliates'], settings: { affiliates: {} } } })
    .returning()
  return s?.id as string
}

const apply = (storeId: string, name: string, settings = manual) =>
  inStore(storeId, (tx) =>
    applyAsAffiliate(
      tx,
      storeId,
      {
        customerId: null,
        email: `${name}@ok.com`,
        phone: null,
        name,
        social: '@x',
        message: '',
        answers: { followers: '4000' },
      },
      settings,
      SECRET,
    ),
  )

const events = (storeId: string) =>
  owner.select({ type: outboxEvent.type }).from(outboxEvent).where(eq(outboxEvent.storeId, storeId))

describe('applications', () => {
  it('a waiting application alerts the merchant; a rejection is recorded and emailed', async () => {
    const storeId = await seed()
    const a = await apply(storeId, 'asha')
    expect(a.answers).toEqual({ followers: '4000' })
    expect((await events(storeId)).map((e) => e.type)).toContain('affiliate.applied')
    const rejected = await inStore(storeId, (tx) =>
      setAffiliateStatus(tx, a.id, 'rejected', 'Audience too small for now'),
    )
    expect(rejected).toMatchObject({
      status: 'rejected',
      rejectReason: 'Audience too small for now',
    })
    expect((await events(storeId)).map((e) => e.type)).toContain('affiliate.rejected')
  })

  it('an auto-approved signup does not alert the merchant', async () => {
    const storeId = await seed()
    await apply(storeId, 'ravi', { ...manual, approval: 'auto' })
    expect((await events(storeId)).map((e) => e.type)).not.toContain('affiliate.applied')
  })
})

describe('clicks, trends and creatives', () => {
  it('counts clicks per day and shows them in the trend', async () => {
    const storeId = await seed()
    const a = await apply(storeId, 'meera', { ...manual, approval: 'auto' })
    await inStore(storeId, (tx) => recordAffiliateClick(tx, storeId, a.code))
    await inStore(storeId, (tx) => recordAffiliateClick(tx, storeId, a.code))
    const [day] = await owner
      .select()
      .from(affiliateClickDay)
      .where(eq(affiliateClickDay.affiliateId, a.id))
    expect(day?.clicks).toBe(2)
    const trend = await inStore(storeId, (tx) =>
      affiliateTrend(tx, { by: 'month', affiliateId: a.id }),
    )
    expect(trend.reduce((s, p) => s + p.clicks, 0)).toBe(2)
    expect((await inStore(storeId, (tx) => ledgerCsv(tx))).split('\n')[0]).toContain('Commission')
    expect(await inStore(storeId, (tx) => topProducts(tx, {}))).toEqual([])
  })

  it('lists a program’s creatives with the all-programs ones, hiding archived', async () => {
    const storeId = await seed()
    const [m] = await owner
      .insert(media)
      .values({ storeId, url: 'https://cdn.example/a.jpg', contentType: 'image/jpeg' })
      .returning()
    const fallback = await inStore(storeId, (tx) => defaultProgram(tx, storeId))
    const other = await inStore(storeId, (tx) =>
      createProgram(tx, storeId, { name: 'Creators', rules: defaultProgramRules }),
    )
    const all = await inStore(storeId, (tx) =>
      saveCreative(tx, storeId, {
        mediaId: m?.id as string,
        programId: null,
        title: 'All',
        caption: '',
      }),
    )
    await inStore(storeId, (tx) =>
      saveCreative(tx, storeId, {
        mediaId: m?.id as string,
        programId: other.id,
        title: 'Creators',
        caption: '',
      }),
    )
    const forDefault = await inStore(storeId, (tx) => listCreatives(tx, { programId: fallback.id }))
    expect(forDefault.map((c) => c.title)).toEqual(['All'])
    await inStore(storeId, (tx) => archiveCreative(tx, all.id, true))
    expect(await inStore(storeId, (tx) => listCreatives(tx, { programId: fallback.id }))).toEqual(
      [],
    )
    expect((await inStore(storeId, (tx) => listCreatives(tx, { archived: true }))).length).toBe(2)
  })
})
