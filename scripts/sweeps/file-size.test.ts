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

const ALLOWLIST: Record<string, { lines: number; reason: string }> = {
  'packages/api/src/routers/gst-invoices.ts': { lines: 530, reason: SPLIT },
  'packages/api/src/routers/store.ts': { lines: 524, reason: SPLIT },
  'packages/api/src/services/analytics-reports.ts': { lines: 554, reason: SPLIT },
  'packages/api/src/services/dashboard.service.ts': { lines: 1027, reason: SPLIT },
  'packages/api/src/services/payments-setup.service.ts': { lines: 515, reason: SPLIT },
  'packages/api/src/services/shipments-workspace.service.ts': { lines: 548, reason: SPLIT },
  'packages/core/src/gift-cards/service.ts': { lines: 705, reason: SPLIT },
  'packages/core/src/marketing/automations.ts': { lines: 837, reason: SPLIT },
  'packages/core/src/marketing/campaigns.ts': { lines: 508, reason: SPLIT },
  'packages/core/src/metaobjects/service.ts': { lines: 768, reason: SPLIT },
  'packages/core/src/notifications/deliver.ts': { lines: 609, reason: SPLIT },
  'packages/core/src/order/place-order.ts': { lines: 1044, reason: SPLIT },
  'packages/core/src/returns/service.ts': { lines: 763, reason: SPLIT },
  'packages/db/src/schema.ts': {
    lines: 2204,
    reason: 'the Drizzle schema; split into per-area schema files (like marketing-schema.ts)',
  },
  'packages/invoices/src/document.ts': { lines: 508, reason: SPLIT },
  'packages/payments-cashfree/src/cashfree.ts': {
    lines: 565,
    reason: 'one gateway adapter implementing the whole provider contract',
  },
  'packages/payments-decentro/src/decentro.ts': {
    lines: 504,
    reason: 'one gateway adapter implementing the whole provider contract',
  },
  'packages/plugin-gst-invoices/src/issue.ts': { lines: 554, reason: SPLIT },
  'packages/plugin-shopify-import/src/shopify-api.ts': {
    lines: 866,
    reason: 'Shopify GraphQL queries and their typed answers',
  },
  'packages/shipping-delhivery/src/delhivery.ts': {
    lines: 719,
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
