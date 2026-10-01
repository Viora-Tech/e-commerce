import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'
import { business, gstRegistration, order, store } from '../src/schema'
import { resetDb } from './reset'

/*
 * 0082 numbers invoices per GSTIN. Its backfill hands every existing invoice, counter and
 * return month to the store's default registration; its trigger does the same when a store
 * adds its first GSTIN later. The columns already exist here (global setup migrated), so only
 * the statements after the BACKFILL marker run again, against rows shaped as before 0082.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)

const MIGRATION = readFileSync(
  join(import.meta.dirname, '..', 'drizzle', '0082_gst_phase_2_3.sql'),
  'utf8',
)
const BACKFILL = MIGRATION.slice(MIGRATION.indexOf('-- BACKFILL'))

async function runBackfill() {
  for (const statement of BACKFILL.split('--> statement-breakpoint')) {
    if (statement.trim()) await owner.execute(sql.raw(statement))
  }
}

/** Seed rows as they were before 0082: the trigger stays off while the old state is built. */
async function withoutTrigger(fn: () => Promise<void>) {
  await owner.execute(
    sql`alter table gst_registration disable trigger gst_registration_adopt_unassigned`,
  )
  try {
    await fn()
  } finally {
    await owner.execute(
      sql`alter table gst_registration enable trigger gst_registration_adopt_unassigned`,
    )
  }
}

async function seedStore(slug: string) {
  const [s] = await owner
    .insert(store)
    .values({ slug, name: `Shop ${slug}` })
    .returning()
  if (!s) throw new Error('seed')
  const [o] = await owner
    .insert(order)
    .values({ storeId: s.id, number: 1, subtotalPaise: 100, totalPaise: 100 })
    .returning()
  return { storeId: s.id, orderId: o?.id as string }
}

async function addRegistration(storeId: string, gstin: string, isDefault: boolean) {
  const [b] = await owner
    .insert(business)
    .values({ storeId, legalName: 'W', pan: gstin.slice(2, 12), isPrimary: true })
    .onConflictDoNothing()
    .returning()
  const businessId =
    b?.id ??
    (
      await owner.execute<{ id: string }>(
        sql`select id from business where store_id = ${storeId} and is_primary`,
      )
    )[0]?.id
  const [r] = await owner
    .insert(gstRegistration)
    .values({ storeId, businessId: businessId as string, gstin, isDefault })
    .returning()
  return r?.id as string
}

async function seedDocuments(storeId: string, orderId: string, numbers: string[]) {
  for (const [i, number] of numbers.entries()) {
    await owner.execute(sql`
      insert into invoice (id, store_id, order_id, kind, status, number, series_id, fy_start_year,
        seq, snapshot, buyer_name, taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise,
        invoice_date)
      values (gen_random_uuid(), ${storeId}, ${orderId}, 'tax_invoice',
        ${i === 0 ? 'issued' : 'cancelled'}, ${number}, 'inv', 2025, ${i + 1}, '{}'::jsonb, 'A',
        0, 0, 0, 0, 0, now())`)
  }
  await owner.execute(sql`
    insert into invoice_sequence (id, store_id, kind, series_id, fy_start_year, next)
    values (gen_random_uuid(), ${storeId}, 'tax_invoice', 'inv', 2025, ${numbers.length + 1})`)
  await owner.execute(sql`
    insert into invoice_period (id, store_id, period, closed_at)
    values (gen_random_uuid(), ${storeId}, '2025-06', now())`)
}

type Owned = { table: string; store_id: string; gst_registration_id: string | null }

async function owners(): Promise<Owned[]> {
  return owner.execute<Owned>(sql`
    select 'invoice' as table, store_id, gst_registration_id from invoice
    union all select 'invoice_sequence', store_id, gst_registration_id from invoice_sequence
    union all select 'invoice_period', store_id, gst_registration_id from invoice_period`)
}

beforeEach(async () => {
  await resetDb(owner)
})

afterAll(async () => {
  await owner.$client.end()
})

describe('0082 backfill', () => {
  it('hands each store’s documents, counters and months to its default GSTIN only', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    let regA = ''
    await withoutTrigger(async () => {
      regA = await addRegistration(a.storeId, '06AAACW1234A1Z5', true)
      await addRegistration(a.storeId, '29AAACW1234A1Z1', false)
      await seedDocuments(a.storeId, a.orderId, ['INV/25-26/0001', 'INV/25-26/0002'])
      await seedDocuments(b.storeId, b.orderId, ['INV/25-26/0001'])
    })
    await runBackfill()
    await runBackfill()

    const rows = await owners()
    const of = (storeId: string) => rows.filter((r) => r.store_id === storeId)
    expect(of(a.storeId)).toHaveLength(4)
    expect(of(a.storeId).every((r) => r.gst_registration_id === regA)).toBe(true)
    // Store b has no GSTIN: its rows wait for its first one.
    expect(of(b.storeId)).toHaveLength(3)
    expect(of(b.storeId).every((r) => r.gst_registration_id === null)).toBe(true)
  })
})

describe('0082 adoption trigger', () => {
  it('a first GSTIN added later adopts the store’s unassigned rows', async () => {
    const a = await seedStore('a')
    await seedDocuments(a.storeId, a.orderId, ['INV/25-26/0001'])
    const reg = await addRegistration(a.storeId, '06AAACW1234A1Z5', true)
    const rows = await owners()
    expect(rows.every((r) => r.gst_registration_id === reg)).toBe(true)
  })

  it('merges with what a returning GSTIN already has, never duplicating a number', async () => {
    const a = await seedStore('a')
    let reg = ''
    await withoutTrigger(async () => {
      reg = await addRegistration(a.storeId, '06AAACW1234A1Z5', false)
      // The registration issued 0001 and 0002 itself; unassigned rows issued 0001 to 0003.
      await owner.execute(sql`
        insert into invoice (id, store_id, order_id, gst_registration_id, kind, number, series_id,
          fy_start_year, seq, snapshot, buyer_name, taxable_paise, cgst_paise, sgst_paise,
          igst_paise, total_paise)
        values (gen_random_uuid(), ${a.storeId}, ${a.orderId}, ${reg}, 'credit_note',
          'INV/25-26/0001', 'inv', 2025, 1, '{}'::jsonb, 'A', 0, 0, 0, 0, 0)`)
      await owner.execute(sql`
        insert into invoice_sequence (id, store_id, gst_registration_id, kind, series_id,
          fy_start_year, next)
        values (gen_random_uuid(), ${a.storeId}, ${reg}, 'tax_invoice', 'inv', 2025, 3)`)
      await owner.execute(sql`
        insert into invoice_period (id, store_id, gst_registration_id, period, gstr1_filed_at)
        values (gen_random_uuid(), ${a.storeId}, ${reg}, '2025-06', now())`)
      await seedDocuments(a.storeId, a.orderId, [
        'INV/25-26/0001',
        'INV/25-26/0002',
        'INV/25-26/0003',
      ])
    })
    await owner.execute(sql`update gst_registration set is_default = true where id = ${reg}`)

    const counters = await owner.execute<{ gst_registration_id: string | null; next: number }>(
      sql`select gst_registration_id, next from invoice_sequence`,
    )
    expect(counters).toEqual([{ gst_registration_id: reg, next: 4 }])
    const months = await owner.execute<{ filed: boolean; closed: boolean; reg: string | null }>(sql`
      select gstr1_filed_at is not null as filed, closed_at is not null as closed,
        gst_registration_id as reg from invoice_period`)
    expect(months).toEqual([{ filed: true, closed: true, reg }])
    const invoices = await owner.execute<{ number: string; reg: string | null }>(sql`
      select number, gst_registration_id as reg from invoice where kind = 'tax_invoice'
      order by number`)
    // 0001 is the registration's already: that one stays unassigned rather than repeat.
    expect(invoices).toEqual([
      { number: 'INV/25-26/0001', reg: null },
      { number: 'INV/25-26/0002', reg },
      { number: 'INV/25-26/0003', reg },
    ])
  })
})
