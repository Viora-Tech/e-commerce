/**
 * Sweep: magic ceilings on router inputs. Rows per page, page number, search text and ids per
 * bulk action share one rule each: `PAGE_SIZE_MAX`, `PAGE_MAX`, `SEARCH_MAX`, `BULK_MAX` in
 * `packages/api/src/procedures/limits.ts`. A `.max(<number>)` on a `perPage`/`page`/`limit`/
 * `search`/`query`/`q`/`ids`-style input in a router is a private copy of that rule.
 *
 * Ratchet: a NEW literal ceiling fails. A deliberately different ceiling stays a literal with
 * an entry here saying why (stale entries fail).
 */
import { describe, expect, it } from 'vitest'
import { routerMagicLimits } from './consistency'

type AllowEntry = { site: string; reason: string }

const SMALL = 'a picker/preview that deliberately shows fewer rows than a list page'

const ALLOWLIST: AllowEntry[] = [
  { site: 'packages/api/src/routers/blog.ts: limit.max(12)', reason: SMALL },
  {
    site: 'packages/api/src/routers/customers.ts: ids.max(5000)',
    reason:
      'bulk-edit spreadsheet rows: matches "Select all" (SELECT_ALL_MAX 5000), a read, not a bulk write',
  },
  {
    site: 'packages/api/src/routers/order-list.ts: ids.max(5000)',
    reason:
      'bulk-edit spreadsheet rows: matches "Select all" (SELECT_ALL_MAX 5000), a read, not a bulk write',
  },
  {
    site: 'packages/api/src/routers/themes.ts: page.max(60)',
    reason: 'a theme page key (template name) for the AI section proposal, not a page number',
  },
  { site: 'packages/api/src/routers/collections.ts: limit.max(50)', reason: SMALL },
  {
    site: 'packages/api/src/routers/collections.ts: productIds.max(500)',
    reason: 'a manual collection may hold more products than one bulk action carries',
  },
  {
    site: 'packages/api/src/routers/gst-invoices-order-actions.ts: orderIds.max(100)',
    reason: 'invoicing orders by hand is capped lower: each order is issued (numbered, PDF) inline',
  },
  {
    site: 'packages/api/src/routers/gst-invoices.ts: page.max(1000)',
    reason:
      'invoice register paging stops earlier than lists; fold into PAGE_MAX in a behaviour change',
  },
  {
    site: 'packages/api/src/routers/gst-invoices.ts: q.max(100)',
    reason:
      'invoice search box is shorter than SEARCH_MAX; fold into SEARCH_MAX in a behaviour change',
  },
  { site: 'packages/api/src/routers/inventory.ts: limit.max(50)', reason: SMALL },
  {
    site: 'packages/api/src/routers/inventory.ts: perPage.max(250)',
    reason: 'stock levels page shows up to 250 variants so a whole product family fits',
  },
  {
    site: 'packages/api/src/routers/metaobjects.ts: ids.max(250)',
    reason:
      'labels for the ids a reference field already holds — deliberately above BULK_MAX, it is a read, not a bulk write',
  },
  { site: 'packages/api/src/routers/products.ts: limit.max(100)', reason: SMALL },
  { site: 'packages/api/src/routers/products.ts: limit.max(50)', reason: SMALL },
  {
    site: 'packages/api/src/routers/products.ts: ids.max(50)',
    reason:
      'variant ids come back in one page of limit <= 50; the combo editor chunks saved picks by the same 50',
  },
  { site: 'packages/api/src/routers/theme-templates.ts: limit.max(50)', reason: SMALL },
  {
    site: 'packages/api/src/routers/redirects.ts: ids.max(250)',
    reason: 'redirect bulk delete matches the 250-row redirects page — fold into BULK_MAX with it',
  },
]

describe('sweep: router-magic-limits', () => {
  it('list/search/bulk ceilings use the shared limits', async () => {
    const sites = await routerMagicLimits()
    const unlisted = sites.filter((s) => !ALLOWLIST.some((e) => e.site === s))
    expect(
      unlisted,
      `use PAGE_SIZE_MAX / PAGE_MAX / SEARCH_MAX / BULK_MAX from ../procedures:\n${unlisted.join('\n')}`,
    ).toEqual([])
  })

  it('the allow-list has no stale entries', async () => {
    const sites = await routerMagicLimits()
    expect(ALLOWLIST.filter((e) => !sites.includes(e.site))).toEqual([])
  })
})
