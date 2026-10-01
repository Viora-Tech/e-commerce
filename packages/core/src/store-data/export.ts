/** SOURCE OF TRUTH: full store export — every store table as NDJSON in one zip, secrets redacted */
import type { StoreTx } from '@commerce/db'
import { sql } from 'drizzle-orm'
import { strToU8, zipSync } from 'fflate'
import { decryptCustomerPhone } from '../customers/phone-crypto'
import { isEncrypted } from '../secrets'
import { listStoreTables } from './tables'

/**
 * A merchant's copy of everything their store holds: one NDJSON file per table (one JSON
 * object per line, column names as in the database), the store row itself, a manifest
 * with row counts, and a short README. Files (product images, invoice PDFs) are not in
 * the zip; their rows are, with the URL each file lives at.
 *
 * Nothing that unlocks anything leaves the platform: encrypted values (gateway keys,
 * gift card codes, import tokens) become `"[encrypted]"`, and columns named like a
 * token, secret, password or hash become `"[redacted]"`. Customer phone numbers are the
 * one encrypted value written in clear, because they are the merchant's own customer
 * data and an export they cannot read is no export.
 *
 * Runs inside one store transaction (`withStore`), so RLS guarantees no other store's
 * row can be read even if a query here were wrong.
 */

export const ENCRYPTED_PLACEHOLDER = '[encrypted]'
export const REDACTED_PLACEHOLDER = '[redacted]'

/** Column or JSON keys whose values are credentials, or one-way hashes and indexes of them. */
const SENSITIVE_KEY = /(^|_)(token|secret|password|passcode)(_|$)|(^|_)hash$|^phone_index$/i

export type StoreExportManifest = {
  format: 'ndjson'
  version: 1
  storeId: string
  storeSlug: string
  storeName: string
  exportedAt: string
  /** Rows per table, by table name. */
  tables: Record<string, number>
}

export type BuiltStoreExport = {
  zip: Uint8Array
  manifest: StoreExportManifest
  tableCount: number
  rowCount: number
}

const README = `Your store's data

This file has everything your store keeps, one file per kind of record:
products, orders, customers, discounts, pages and the rest.

- store.json: your store's own settings.
- tables/<name>.ndjson: one record per line. Open it in a text editor, or load
  it in a spreadsheet or database tool that reads JSON lines.
- manifest.json: how many records each file has, and when this was made.

Photos, videos and invoice PDFs are not inside this file. Each one is listed
with its web address in tables/media.ndjson and the related tables.

Passwords, payment keys and gift card codes are not included. They show as
[encrypted] or [redacted].
`

/** Redacts one value. `key` is the column or JSON key it sits under. */
function clean(value: unknown, key: string, phoneSecret: string | null): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    if (phoneSecret !== null && key === 'phone' && isEncrypted(value)) {
      return decryptCustomerPhone(value, phoneSecret) ?? ENCRYPTED_PLACEHOLDER
    }
    if (isEncrypted(value)) return ENCRYPTED_PLACEHOLDER
    if (SENSITIVE_KEY.test(key)) return REDACTED_PLACEHOLDER
    return value
  }
  if (Array.isArray(value)) return value.map((v) => clean(v, key, null))
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, clean(v, k, null)]),
    )
  }
  return value
}

/** One database row (from `row_to_json`) made safe to hand to the merchant. */
export function redactRow(
  table: string,
  row: Record<string, unknown>,
  secret: string,
): Record<string, unknown> {
  const phoneSecret = table === 'customer' ? secret : null
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, clean(v, k, phoneSecret)]))
}

async function readRows(
  tx: StoreTx,
  table: string,
  where: ReturnType<typeof sql>,
): Promise<Record<string, unknown>[]> {
  const rows = await tx.execute<{ row: Record<string, unknown> }>(
    sql`select row_to_json(t) as row from ${sql.identifier(table)} t where ${where}`,
  )
  return rows.map((r) => r.row)
}

export async function buildStoreExport(
  tx: StoreTx,
  storeId: string,
  opts: { secret: string; now?: Date | undefined },
): Promise<BuiltStoreExport> {
  const [storeRow] = await readRows(tx, 'store', sql`t.id = ${storeId}`)
  if (!storeRow) throw new Error('store not found')

  const { tables } = await listStoreTables(tx)
  const files: Record<string, Uint8Array> = {}
  const counts: Record<string, number> = {}
  let rowCount = 0
  for (const table of tables) {
    const rows = await readRows(tx, table, sql`t.store_id = ${storeId}`)
    counts[table] = rows.length
    rowCount += rows.length
    const lines = rows.map((r) => JSON.stringify(redactRow(table, r, opts.secret)))
    files[`tables/${table}.ndjson`] = strToU8(lines.length ? `${lines.join('\n')}\n` : '')
  }

  const manifest: StoreExportManifest = {
    format: 'ndjson',
    version: 1,
    storeId,
    storeSlug: String(storeRow.slug ?? ''),
    storeName: String(storeRow.name ?? ''),
    exportedAt: (opts.now ?? new Date()).toISOString(),
    tables: counts,
  }
  files['README.txt'] = strToU8(README)
  files['manifest.json'] = strToU8(`${JSON.stringify(manifest, null, 2)}\n`)
  files['store.json'] = strToU8(
    `${JSON.stringify(redactRow('store', storeRow, opts.secret), null, 2)}\n`,
  )

  return { zip: zipSync(files, { level: 6 }), manifest, tableCount: tables.length, rowCount }
}
