/** SOURCE OF TRUTH: Shopify files the importer copied, for `file_url` — WHAT: file name → our stored URL, read from the import mapping / WHY: an imported theme's `file_url` must print our copy, not the old store's address */
import type { StoreTx } from '@commerce/db'
import { sql } from 'drizzle-orm'
import { importedFileKey } from './filter-values'

/**
 * Files the Shopify importer copied, by file name. The importer records images by their
 * CDN address (`media`, the last part is the file name) and videos by name (`file_name`).
 */
export async function loadImportedFiles(tx: StoreTx): Promise<Map<string, string>> {
  const rows = await tx.execute<{ resource: string; source_id: string; url: string }>(
    sql`select m.resource, m.source_id, md.url
      from shopify_import_mapping m join media md on md.id = m.local_id
      where m.resource in ('media', 'file_name') and md.status <> 'failed'`,
  )
  const out = new Map<string, string>()
  for (const r of rows) {
    const last = r.source_id.split(/[?#]/)[0]?.split('/').pop() ?? ''
    let name = last
    try {
      name = decodeURIComponent(last)
    } catch {
      // keep the raw name
    }
    const key = importedFileKey(r.resource === 'file_name' ? r.source_id : name)
    if (key && !out.has(key)) out.set(key, r.url)
  }
  return out
}
