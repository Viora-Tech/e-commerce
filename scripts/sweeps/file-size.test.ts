/**
 * Sweep: oversized modules. A `.ts` file (not tests, not migrations) over
 * `FILE_SIZE_MAX_LINES` (500) lines usually holds several concerns and is where duplicates
 * hide; split it by concern when you next change it. `.tsx` components are held by the
 * component-structure lint instead.
 *
 * Ratchet: a NEW file over the limit fails. A listed file may not grow past its recorded size
 * plus a small margin; one that drops under the limit must leave the list (stale fails).
 */
import { describe, expect, it } from 'vitest'
import { FILE_SIZE_MAX_LINES, oversizedFiles } from './consistency'

/** Room for a small fix in a listed file without touching this list. */
const GROWTH_MARGIN = 50

const SPLIT = 'several concerns in one module — split by concern when it next changes'

const COPY =
  'copy for one admin area (data/<feature>.ts, mirrored in data/hi) — split by screen when it next changes'

const ALLOWLIST: Record<string, { lines: number; reason: string }> = {
  'apps/admin/src/data/customize.ts': { lines: 556, reason: COPY },
  'apps/admin/src/data/hi/orders.ts': { lines: 539, reason: COPY },
  'apps/admin/src/data/orders.ts': { lines: 543, reason: COPY },
  'apps/storefront/src/lib/liquid-theme.ts': { lines: 560, reason: SPLIT },
  'packages/api/src/routers/gst-invoices.ts': { lines: 510, reason: SPLIT },
  'packages/api/src/routers/store.ts': { lines: 524, reason: SPLIT },
  'packages/api/src/services/analytics-reports.ts': { lines: 554, reason: SPLIT },
  'packages/api/src/services/dashboard.service.ts': { lines: 1027, reason: SPLIT },
  'packages/api/src/services/order.service.ts': { lines: 527, reason: SPLIT },
  'packages/api/src/services/customer.service.ts': { lines: 509, reason: SPLIT },
  'packages/api/src/services/payments-setup.service.ts': {
    lines: 626,
    reason:
      'gateway setup plus the Live/Test and Active switches — move the switches into their own module',
  },
  'packages/api/src/services/product.service.ts': { lines: 501, reason: SPLIT },
  'packages/blocks/src/section-settings.ts': {
    lines: 524,
    reason: 'the typed setting schema every storefront section reads — split per section group',
  },
  'packages/core/src/api-access/service.ts': {
    lines: 856,
    reason: 'API keys plus the OAuth server for MCP clients — split OAuth into its own module',
  },
  'packages/core/src/billing/service.ts': {
    lines: 502,
    reason:
      'plan billing: checkout, renewals and allowances — split renewals into their own module',
  },
  'packages/core/src/gift-cards/service.ts': { lines: 705, reason: SPLIT },
  'packages/core/src/marketing/automations.ts': { lines: 837, reason: SPLIT },
  'packages/core/src/marketing/campaigns.ts': { lines: 508, reason: SPLIT },
  'packages/core/src/metaobjects/service.ts': { lines: 768, reason: SPLIT },
  'packages/core/src/notifications/deliver.ts': { lines: 609, reason: SPLIT },
  'packages/core/src/order/place-order.ts': { lines: 1044, reason: SPLIT },
  'packages/core/src/returns/service.ts': { lines: 763, reason: SPLIT },
  'packages/core/src/sales-channels/providers.ts': {
    lines: 541,
    reason: 'Meta and Google Merchant Center adapters in one module — split one file per provider',
  },
  'packages/core/src/theme-code/files.ts': { lines: 550, reason: SPLIT },
  'packages/core/src/theme-import/resource-drops.ts': {
    lines: 568,
    reason: 'Liquid drops for every resource — split collection/search drops into their own module',
  },
  'packages/db/src/schema.ts': {
    lines: 2446,
    reason: 'the Drizzle schema; split into per-area schema files (like marketing-schema.ts)',
  },
  'packages/invoices/src/document.ts': { lines: 508, reason: SPLIT },
  'packages/payments-decentro/src/decentro.ts': {
    lines: 504,
    reason: 'one gateway adapter implementing the whole provider contract',
  },
  'packages/plugin-gst-invoices/src/issue.ts': { lines: 529, reason: SPLIT },
  'packages/plugin-shopify-import/src/shopify-api.ts': {
    lines: 957,
    reason: 'Shopify GraphQL queries and their typed answers',
  },
  'packages/shipping-delhivery/src/delhivery.ts': {
    lines: 831,
    reason: 'one courier adapter implementing the whole provider contract',
  },
  'packages/shipping-rapidshyp/src/rapidshyp.ts': {
    lines: 910,
    reason: 'one courier adapter implementing the whole provider contract',
  },
  'packages/shipping-shiprocket/src/shiprocket.ts': {
    lines: 749,
    reason: 'one courier adapter implementing the whole provider contract',
  },
  'packages/shipping/src/delivery-date.ts': { lines: 505, reason: SPLIT },
}

describe('sweep: file-size', () => {
  it(`no new .ts module over ${FILE_SIZE_MAX_LINES} lines, and listed ones do not keep growing`, async () => {
    const sizes = await oversizedFiles()
    const problems = Object.entries(sizes)
      .filter(([file, lines]) => {
        const allowed = ALLOWLIST[file]
        return !allowed || lines > allowed.lines + GROWTH_MARGIN
      })
      .map(([file, lines]) => `${file}: ${lines} lines`)
    expect(problems, 'split the module by concern').toEqual([])
  })

  it('the allow-list has no stale entries', async () => {
    const sizes = await oversizedFiles()
    expect(Object.keys(ALLOWLIST).filter((f) => sizes[f] === undefined)).toEqual([])
  })
})
