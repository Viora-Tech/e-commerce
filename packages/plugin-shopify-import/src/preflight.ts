/**
 * "Before you import": what is not set up for the resources the merchant
 * chose, checked before Preview import and Import now so a run does not fail
 * thousands of times over something one setting fixes (no file storage, a
 * missing Shopify scope, orders without their products).
 */
import type { StoreTx } from '@commerce/db'
import { count, eq } from 'drizzle-orm'
import {
  type ImportResource,
  type PreflightCheck,
  REQUIRED_SCOPES,
  RESOURCE_SCOPES,
  type ScopeCheck,
} from './client'
import { importMapping } from './schema'

const STORAGE_HREF = '/content/files/storage'
const CONNECT_HREF = '/apps/shopify-import/connect'

/** Resources whose import copies images or files. */
const WITH_MEDIA: ImportResource[] = [
  'products',
  'collections',
  'articles',
  'files',
  'metaobjects',
  'metafields',
]

export type PreflightInput = {
  mode: 'api' | 'csv'
  resources: readonly ImportResource[]
  /** The provider uploads go to right now (`local` is the folder fallback). */
  storage: { providerId: string; production: boolean }
  /** The token's scopes, or why they could not be read; null for a CSV import. */
  scopes: ScopeCheck | { error: string } | null
}

async function imported(tx: StoreTx, resource: string): Promise<boolean> {
  const [row] = await tx
    .select({ n: count() })
    .from(importMapping)
    .where(eq(importMapping.resource, resource))
  return (row?.n ?? 0) > 0
}

export async function preflightChecks(
  tx: StoreTx,
  input: PreflightInput,
): Promise<PreflightCheck[]> {
  const chosen = (r: ImportResource) => input.resources.includes(r)
  const checks: PreflightCheck[] = []

  if (input.resources.some((r) => WITH_MEDIA.includes(r))) {
    const local = input.storage.providerId === 'local'
    checks.push({
      id: 'storage',
      status: local && input.storage.production ? 'warn' : 'ok',
      title: 'File storage',
      help: "Images and files can't be copied: no storage is connected. Connect Cloudflare R2 or Amazon S3 first, or images will be skipped.",
      fixHref: STORAGE_HREF,
    })
  }

  if (input.mode === 'api' && input.scopes) {
    if ('error' in input.scopes) {
      checks.push({
        id: 'connection',
        status: 'block',
        detail: input.scopes.error,
        title: 'Shopify connection',
        help: `Shopify did not answer: ${input.scopes.error}. Check the connection, then try again.`,
        fixHref: CONNECT_HREF,
      })
    } else {
      const missing = new Set(input.scopes.missing)
      for (const resource of input.resources) {
        const lacking = RESOURCE_SCOPES[resource].filter((s) => missing.has(s))
        if (lacking.length === 0) continue
        checks.push({
          id: 'scope',
          status: 'block',
          resource,
          detail: lacking.join(', '),
          title: `Shopify access for ${resource}`,
          help: `Your Shopify app needs ${REQUIRED_SCOPES[resource]} to read this. Add the scope in Shopify, then test the connection again.`,
          fixHref: CONNECT_HREF,
        })
      }
      if (chosen('orders') && missing.has('read_all_orders') && !missing.has('read_orders')) {
        checks.push({
          id: 'all_orders',
          status: 'warn',
          resource: 'orders',
          detail: 'read_all_orders',
          title: 'Older orders',
          help: 'Without read_all_orders Shopify only shares the last 60 days of orders.',
          fixHref: CONNECT_HREF,
        })
      }
    }
  }

  const productsHere = chosen('products') || (await imported(tx, 'products'))
  const needProducts = (['orders', 'collections', 'discounts', 'metafields'] as const).filter((r) =>
    chosen(r),
  )
  if (!productsHere) {
    for (const resource of needProducts) {
      checks.push({
        id: 'needs_products',
        status: 'warn',
        resource,
        title: 'Products not imported yet',
        help: 'Import products first (or tick them too): without them order lines point to a placeholder item, collections and discounts come over empty, and product extra fields are skipped.',
        fixHref: null,
      })
    }
  }
  if (chosen('gift_cards') && !chosen('customers') && !(await imported(tx, 'customers'))) {
    checks.push({
      id: 'needs_customers',
      status: 'warn',
      resource: 'gift_cards',
      title: 'Customers not imported yet',
      help: 'Gift cards belong to customers. Tick customers too, or cards for unknown customers are skipped.',
      fixHref: null,
    })
  }
  return checks
}
