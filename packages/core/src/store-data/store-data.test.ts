/** SOURCE OF TRUTH: store export and delete tests — every table, both directions, nothing of another store */
import {
  authSchema,
  createDb,
  customer,
  platformAuditEvent,
  privacyAuditEvent,
  store,
  storeExport,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { type SeededStore, seedEveryTable } from '@commerce/db/test/seed'
import { MemoryStorageProvider } from '@commerce/storage'
import { eq, sql } from 'drizzle-orm'
import { strFromU8, unzipSync } from 'fflate'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { encryptCustomerPhone } from '../customers/phone-crypto'
import { encryptSecret } from '../secrets'
import { deleteStoreFiles, storeFilesPrefix } from './delete'
import { ENCRYPTED_PLACEHOLDER, REDACTED_PLACEHOLDER, redactRow } from './export'
import {
  deleteConfirmationMatches,
  deleteStore,
  listStoreExports,
  purgeExpiredExports,
  readStoreExport,
  requestStoreExport,
  runStoreExport,
} from './service'
import { deletionOrder, listStoreTables } from './tables'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'store-data-test-secret'
const actor = { userId: 'user-1', email: 'owner@example.test' }

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

type Seeded = SeededStore & { organizationId: string; userId: string }

/** A store with a Better Auth organization and member, and a row in every store table. */
async function seedStore(slug: string): Promise<Seeded> {
  const userId = `user-${slug}`
  const organizationId = `org-${slug}`
  await owner
    .insert(authSchema.user)
    .values({ id: userId, name: slug, email: `${slug}@example.test` })
  await owner.insert(authSchema.organization).values({
    id: organizationId,
    name: slug,
    slug,
    createdAt: new Date(),
  })
  await owner.insert(authSchema.member).values({
    id: `member-${slug}`,
    organizationId,
    userId,
    role: 'owner',
    createdAt: new Date(),
  })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: `Store ${slug}`, organizationId })
    .returning()
  if (!s) throw new Error('seed')
  const seeded = await seedEveryTable(owner, s.id, {
    globals: { user: userId, organization: organizationId },
    rowsPerTable: 2,
  })
  // Generated export rows would look like pending exports; these tests make their own.
  await owner.delete(storeExport).where(eq(storeExport.storeId, s.id))
  seeded.ids.delete('store_export')
  return { ...seeded, organizationId, userId }
}

/** Rows per store table for one store, read as owner (no RLS). */
async function rowCounts(storeId: string): Promise<Record<string, number>> {
  const { tables } = await listStoreTables(owner as never)
  const out: Record<string, number> = {}
  for (const t of tables) {
    const [r] = await owner.execute<{ n: number }>(
      sql`select count(*)::int as n from ${sql.identifier(t)} where store_id = ${storeId}`,
    )
    out[t] = r?.n ?? 0
  }
  return out
}

describe('deletionOrder', () => {
  it('puts children before parents and is stable', () => {
    const order = deletionOrder({
      tables: ['product', 'variant', 'order', 'order_line', 'store_note'],
      edges: [
        ['variant', 'product'],
        ['order_line', 'order'],
        ['order_line', 'variant'],
      ],
    })
    expect(order.indexOf('order_line')).toBeLessThan(order.indexOf('variant'))
    expect(order.indexOf('variant')).toBeLessThan(order.indexOf('product'))
    expect(order.indexOf('order_line')).toBeLessThan(order.indexOf('order'))
    expect(order).toHaveLength(5)
  })

  it('refuses a cycle and names the tables in it', () => {
    expect(() =>
      deletionOrder({
        tables: ['a', 'b', 'c'],
        edges: [
          ['a', 'b'],
          ['b', 'a'],
        ],
      }),
    ).toThrow(/a, b/)
  })

  it('the real schema has an order: no store table cycle exists today', async () => {
    const tables = await listStoreTables(owner as never)
    expect(tables.tables.length).toBeGreaterThan(50)
    expect(deletionOrder(tables)).toHaveLength(tables.tables.length)
  })
})

describe('the generic seeder reaches every store table', () => {
  it('puts a row in each one (so export, delete and leak tests see the whole schema)', async () => {
    const a = await seedStore('seed-a')
    expect(a.failed).toEqual([])
    const { tables } = await listStoreTables(owner as never)
    expect(a.seeded.sort()).toEqual(tables)
  })
})

describe('redactRow', () => {
  it('hides secrets and hashes, keeps the customer phone readable', () => {
    const { cipher } = encryptCustomerPhone('9876543210', SECRET)
    expect(
      redactRow(
        'customer',
        { id: 'c1', phone: cipher, phone_index: 'abc', email: 'a@b.c' },
        SECRET,
      ),
    ).toEqual({ id: 'c1', phone: '9876543210', phone_index: REDACTED_PLACEHOLDER, email: 'a@b.c' })
    expect(
      redactRow(
        'store',
        {
          payments: {
            providers: { razorpay: { key_id: 'pub', key_secret: encryptSecret('x', SECRET) } },
          },
        },
        SECRET,
      ),
    ).toEqual({
      payments: { providers: { razorpay: { key_id: 'pub', key_secret: ENCRYPTED_PLACEHOLDER } } },
    })
    expect(
      redactRow('customer_session', { token_hash: 'h', access_token: 't', code: 'ok' }, SECRET),
    ).toEqual({ token_hash: REDACTED_PLACEHOLDER, access_token: REDACTED_PLACEHOLDER, code: 'ok' })
    // A phone that is not a customer's own column is not decrypted.
    expect(redactRow('cart', { phone: cipher }, SECRET)).toEqual({ phone: ENCRYPTED_PLACEHOLDER })
  })
})

describe('store export', () => {
  it("contains every table of the store, and nothing of another store's", async () => {
    const a = await seedStore('exp-a')
    const b = await seedStore('exp-b')
    await owner
      .update(customer)
      .set({ phone: encryptCustomerPhone('9998887776', SECRET).cipher })
      .where(eq(customer.storeId, a.storeId))

    const provider = new MemoryStorageProvider()
    const requested = await withStore(app, a.storeId, (tx) =>
      requestStoreExport(tx, a.storeId, actor),
    )
    expect(requested.created).toBe(true)
    // Asking again while one is pending returns the same one.
    const again = await withStore(app, a.storeId, (tx) => requestStoreExport(tx, a.storeId, actor))
    expect(again).toEqual({ exportId: requested.exportId, created: false })

    await runStoreExport((fn) => withStore(app, a.storeId, fn), {
      storeId: a.storeId,
      exportId: requested.exportId,
      provider,
      secret: SECRET,
    })

    const [row] = await owner
      .select()
      .from(storeExport)
      .where(eq(storeExport.id, requested.exportId))
    expect(row?.status).toBe('ready')
    expect(row?.key?.startsWith(`${storeFilesPrefix(a.storeId)}private/exports/`)).toBe(true)

    const download = await withStore(app, a.storeId, (tx) =>
      readStoreExport(tx, provider, { storeId: a.storeId, exportId: requested.exportId, actor }),
    )
    if (!download) throw new Error('no download')
    expect(download.filename).toMatch(/^exp-a-data-\d{4}-\d{2}-\d{2}\.zip$/)

    const files = unzipSync(download.bytes)
    const manifest = JSON.parse(strFromU8(files['manifest.json'] as Uint8Array))
    const { tables } = await listStoreTables(owner as never)
    expect(Object.keys(manifest.tables).sort()).toEqual(tables)
    const counts = await rowCounts(a.storeId)
    expect(manifest.tables).toEqual(counts)

    const everything = Object.values(files)
      .map((f) => strFromU8(f))
      .join('\n')
    // Store A's own ids are there...
    expect(everything).toContain(a.storeId)
    for (const id of a.ids.get('product') ?? []) expect(everything).toContain(id)
    // ...and not one id that belongs to store B.
    expect(everything).not.toContain(b.storeId)
    for (const [table, list] of b.ids) {
      for (const id of list) expect(everything, `${table} ${id}`).not.toContain(id)
    }
    // The phone is readable, the ciphertext is not there.
    expect(everything).toContain('9998887776')

    const audit = await owner.select().from(platformAuditEvent)
    expect(audit.map((e) => e.action).sort()).toEqual([
      'store.export_downloaded',
      'store.export_requested',
    ])
    const listed = await withStore(app, a.storeId, (tx) => listStoreExports(tx))
    expect(listed[0]).toMatchObject({ id: requested.exportId, status: 'ready', downloadable: true })
  })

  it('an expired export cannot be downloaded and its file is purged', async () => {
    const a = await seedStore('exp-c')
    const provider = new MemoryStorageProvider()
    const { exportId } = await withStore(app, a.storeId, (tx) =>
      requestStoreExport(tx, a.storeId, actor),
    )
    await runStoreExport((fn) => withStore(app, a.storeId, fn), {
      storeId: a.storeId,
      exportId,
      provider,
      secret: SECRET,
    })
    const later = new Date(Date.now() + 8 * 86_400_000)
    const expired = await withStore(app, a.storeId, (tx) =>
      readStoreExport(tx, provider, { storeId: a.storeId, exportId, actor, now: later }),
    )
    expect(expired).toBeNull()
    const purged = await withStore(app, a.storeId, (tx) => purgeExpiredExports(tx, provider, later))
    expect(purged).toBe(1)
    expect([...provider.objects.keys()].some((k) => k.includes('/exports/'))).toBe(false)
  })

  it('a failed build is recorded with its reason', async () => {
    const a = await seedStore('exp-d')
    const provider = new MemoryStorageProvider()
    provider.put = async () => {
      throw new Error('bucket is full')
    }
    const { exportId } = await withStore(app, a.storeId, (tx) =>
      requestStoreExport(tx, a.storeId, actor),
    )
    await expect(
      runStoreExport((fn) => withStore(app, a.storeId, fn), {
        storeId: a.storeId,
        exportId,
        provider,
        secret: SECRET,
      }),
    ).rejects.toThrow('bucket is full')
    const [row] = await owner.select().from(storeExport).where(eq(storeExport.id, exportId))
    expect(row).toMatchObject({ status: 'failed', error: 'bucket is full' })
  })
})

describe('store delete', () => {
  it('removes every row and file of the store, leaves the other store whole, and is audited', async () => {
    const a = await seedStore('del-a')
    const b = await seedStore('del-b')
    const bBefore = await rowCounts(b.storeId)

    const provider = new MemoryStorageProvider()
    const body = new Uint8Array([1, 2, 3])
    await provider.put({ key: `stores/${a.storeId}/media/a.png`, body, contentType: 'image/png' })
    await provider.put({
      key: `stores/${a.storeId}/private/invoices/a.pdf`,
      body,
      contentType: 'application/pdf',
    })
    await provider.put({ key: `stores/${b.storeId}/media/b.png`, body, contentType: 'image/png' })

    const result = await withStore(app, a.storeId, (tx) =>
      deleteStore(tx, { storeId: a.storeId, actor, providers: [provider] }),
    )
    expect(result.files).toBe(2)
    expect(result.rows).toBeGreaterThan(80)

    // Not one store_id row of A is left, in any table.
    const aAfter = await rowCounts(a.storeId)
    expect(Object.entries(aAfter).filter(([, n]) => n > 0)).toEqual([])
    expect(await owner.select().from(store).where(eq(store.id, a.storeId))).toEqual([])
    // Its organization and membership are gone; the user account stays.
    expect(
      await owner
        .select()
        .from(authSchema.organization)
        .where(eq(authSchema.organization.id, a.organizationId)),
    ).toEqual([])
    expect(
      await owner
        .select()
        .from(authSchema.member)
        .where(eq(authSchema.member.organizationId, a.organizationId)),
    ).toEqual([])
    expect(
      await owner.select().from(authSchema.user).where(eq(authSchema.user.id, a.userId)),
    ).toHaveLength(1)

    // Store B is exactly as it was, files included.
    expect(await rowCounts(b.storeId)).toEqual(bBefore)
    expect(await provider.get(`stores/${b.storeId}/media/b.png`)).not.toBeNull()
    expect([...provider.objects.keys()].some((k) => k.includes(a.storeId))).toBe(false)

    const [audit] = await owner.select().from(platformAuditEvent)
    expect(audit).toMatchObject({
      subjectStoreId: a.storeId,
      subjectStoreSlug: 'del-a',
      action: 'store.deleted',
      actorEmail: actor.email,
    })
  })

  it('outside a store delete the privacy audit trail is still append only', async () => {
    const a = await seedStore('del-c')
    await expect(
      withStore(app, a.storeId, (tx) =>
        tx.delete(privacyAuditEvent).where(eq(privacyAuditEvent.storeId, a.storeId)),
      ),
    ).rejects.toThrow()
  })

  it('the app role can write the platform audit trail but never read it', async () => {
    const a = await seedStore('del-d')
    await expect(
      withStore(app, a.storeId, (tx) => tx.select().from(platformAuditEvent)),
    ).rejects.toThrow()
  })

  it('a provider without folder delete gets each known media key', async () => {
    const deleted: string[] = []
    const provider = {
      id: 'plain',
      delete: async (key: string) => {
        deleted.push(key)
      },
    } as unknown as MemoryStorageProvider
    const n = await deleteStoreFiles([provider], 's1', [
      { provider: 'plain', key: 'stores/s1/media/x.png' },
      { provider: 'other', key: 'stores/s1/media/y.png' },
    ])
    expect(n).toBe(1)
    expect(deleted).toEqual(['stores/s1/media/x.png'])
  })

  it('the confirmation must be the store name', () => {
    expect(deleteConfirmationMatches('  waimers ', 'Waimers')).toBe(true)
    expect(deleteConfirmationMatches('waimer', 'Waimers')).toBe(false)
    expect(deleteConfirmationMatches('', '')).toBe(false)
  })
})
