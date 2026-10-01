import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'
import { business, gstRegistration, store } from '../src/schema'
import { resetDb } from './reset'

/*
 * 0080 adds business and gst_registration and backfills them from store.gstin. The
 * tables already exist here (global setup migrated), so only the statements after the
 * BACKFILL marker are run again, against stores shaped as the old schema left them.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)

const MIGRATION = readFileSync(
  join(import.meta.dirname, '..', 'drizzle', '0080_gst_registrations.sql'),
  'utf8',
)
const BACKFILL = MIGRATION.slice(MIGRATION.indexOf('-- BACKFILL'))

async function runBackfill() {
  for (const statement of BACKFILL.split('--> statement-breakpoint')) {
    if (statement.trim()) await owner.execute(sql.raw(statement))
  }
}

async function seedStore(slug: string, values: Partial<typeof store.$inferInsert> = {}) {
  const [s] = await owner
    .insert(store)
    .values({ slug, name: `Shop ${slug}`, ...values })
    .returning()
  if (!s) throw new Error('seed')
  return s.id
}

beforeEach(async () => {
  await resetDb(owner)
})

afterAll(async () => {
  await owner.$client.end()
})

describe('0080 backfill', () => {
  it('gives a store with a GSTIN one primary business and one default registration', async () => {
    const id = await seedStore('w', {
      gstin: ' 06aaacw1234a1z5 ',
      address: { line1: '12 Mall Road', city: 'Gurugram', state: 'HR', pincode: '122001' },
    })
    await runBackfill()

    const businesses = await owner.select().from(business).where(eq(business.storeId, id))
    expect(businesses).toHaveLength(1)
    expect(businesses[0]).toMatchObject({ legalName: 'Shop w', pan: 'AAACW1234A', isPrimary: true })

    const regs = await owner.select().from(gstRegistration).where(eq(gstRegistration.storeId, id))
    expect(regs).toHaveLength(1)
    expect(regs[0]).toMatchObject({
      gstin: '06AAACW1234A1Z5',
      stateCode: '06',
      isDefault: true,
      businessId: businesses[0]?.id,
      legalAddress: { line1: '12 Mall Road', line2: '', city: 'Gurugram', pincode: '122001' },
    })

    const [s] = await owner.select({ gstin: store.gstin }).from(store).where(eq(store.id, id))
    expect(s?.gstin).toBe('06AAACW1234A1Z5')
  })

  it('prefers the GST invoices seller block for legal name and address', async () => {
    const id = await seedStore('w', { gstin: '06AAACW1234A1Z5' })
    await owner.execute(sql`
      insert into invoice_settings (id, store_id, settings)
      values (gen_random_uuid(), ${id}, ${JSON.stringify({
        seller: {
          legalName: 'Waimers Pvt Ltd',
          line1: 'Plot 4',
          city: 'Manesar',
          pincode: '122050',
        },
      })}::jsonb)`)
    await runBackfill()

    const [b] = await owner.select().from(business).where(eq(business.storeId, id))
    expect(b?.legalName).toBe('Waimers Pvt Ltd')
    const [r] = await owner.select().from(gstRegistration).where(eq(gstRegistration.storeId, id))
    expect(r?.legalAddress).toEqual({
      line1: 'Plot 4',
      line2: '',
      city: 'Manesar',
      pincode: '122050',
    })
  })

  it('creates nothing for a store without a well-formed GSTIN, and is safe to run twice', async () => {
    const none = await seedStore('a')
    const junk = await seedStore('b', { gstin: 'not-a-gstin' })
    const good = await seedStore('c', { gstin: '06AAACW1234A1Z5' })
    await runBackfill()
    await runBackfill()

    const counts = await owner.execute<{ store_id: string; b: number; r: number }>(sql`
      select s.id as store_id,
        (select count(*)::int from business b where b.store_id = s.id) as b,
        (select count(*)::int from gst_registration r where r.store_id = s.id) as r
      from store s`)
    const by = Object.fromEntries(counts.map((c) => [c.store_id, [c.b, c.r]]))
    expect(by[none]).toEqual([0, 0])
    expect(by[junk]).toEqual([0, 0])
    expect(by[good]).toEqual([1, 1])
  })
})
