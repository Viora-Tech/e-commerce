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
  'apps/admin/src/data/automations.ts': { lines: 675, reason: COPY },
  'apps/admin/src/data/hi/automations.ts': { lines: 655, reason: COPY },
  'packages/api/src/services/marketing-overview.service.ts': { lines: 503, reason: SPLIT },
  'apps/admin/src/data/customize.ts': { lines: 556, reason: COPY },
  'apps/admin/src/data/settings-search.ts': {
    lines: 505,
    reason:
      'the settings search index, one entry per settings page and field — split by settings group when it next changes',
  },
  'apps/storefront/src/lib/liquid-theme.ts': { lines: 560, reason: SPLIT },
  'packages/api/src/routers/store.ts': { lines: 524, reason: SPLIT },
  'packages/api/src/services/analytics-reports.ts': { lines: 554, reason: SPLIT },
  'packages/api/src/services/dashboard.service.ts': { lines: 950, reason: SPLIT },
  'packages/api/src/services/payments-setup.service.ts': {
    lines: 626,
    reason:
      'gateway setup plus the Live/Test and Active switches — move the switches into their own module',
  },
  'packages/blocks/src/section-settings.ts': {
    lines: 524,
    reason: 'the typed setting schema every storefront section reads — split per section group',
  },
  'packages/core/src/api-access/service.ts': {
    lines: 856,
    reason: 'API keys plus the OAuth server for MCP clients — split OAuth into its own module',
  },
  'apps/worker/src/index.ts': {
    lines: 512,
    reason:
      'the worker entry wires every queue, worker, schedule and shutdown in one place; a jobs registry would split it',
  },
  'packages/core/src/billing/service.ts': {
    lines: 716,
    reason:
      'plan bills, the sales-store order behind every bill and the billing sweep (fee bills moved out in #973)',
  },
  'packages/core/src/gift-cards/service.ts': { lines: 705, reason: SPLIT },
  'packages/core/src/marketing/automations.ts': { lines: 765, reason: SPLIT },
  'packages/core/src/marketing/campaigns.ts': { lines: 508, reason: SPLIT },
  'packages/core/src/metaobjects/service.ts': { lines: 768, reason: SPLIT },
  'packages/core/src/notifications/deliver.ts': { lines: 609, reason: SPLIT },
  'packages/core/src/returns/service.ts': { lines: 763, reason: SPLIT },
  'packages/core/src/theme-code/files.ts': { lines: 550, reason: SPLIT },
  'packages/core/src/theme-import/resource-drops.ts': {
    lines: 568,
    reason: 'Liquid drops for every resource — split collection/search drops into their own module',
  },
  'packages/plugin-shopify-import/src/write-content.ts': {
    lines: 505,
    reason:
      'collections, pages, blogs, menus and redirects in one writer — split one file per resource',
  },
  'packages/db/src/schema.ts': {
    lines: 2549,
    reason: 'the Drizzle schema; split into per-area schema files (like marketing-schema.ts)',
  },
  'packages/config/src/env.ts': {
    lines: 516,
    reason:
      'every env setting with its doc comment; split per area (auth, payments, AI) into env/*.ts',
  },
  'packages/core/src/sales-channels/connect.ts': { lines: 503, reason: SPLIT },
  'packages/payments-decentro/src/decentro.ts': {
    lines: 504,
    reason: 'one gateway adapter implementing the whole provider contract',
  },
  'packages/plugin-gst-invoices/src/issue.ts': { lines: 529, reason: SPLIT },
  'packages/shipping-delhivery/src/delhivery.ts': {
    lines: 831,
    reason: 'one courier adapter implementing the whole provider contract',
  },
  'packages/shipping-dhl-express/src/dhl-express.ts': {
    lines: 743,
    reason: 'one courier adapter implementing the whole provider contract',
  },
  'packages/shipping-fedex/src/fedex.ts': {
    lines: 827,
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
