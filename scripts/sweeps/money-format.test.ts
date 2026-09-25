/**
 * Sweep: `Intl.NumberFormat(...)` call sites outside a canonical money module. Today the
 * repo has several independent INR (and a couple of other) formatters — this sweep
 * freezes that list. A follow-up PR is expected to add a shared currency-aware money
 * module (INR/EUR/USD); once that lands, new formatters should import from it instead
 * of calling `Intl.NumberFormat` directly, and the allow-list entries here should move
 * their formatting logic into it and shrink. Naming it "money-format" (not
 * "intl-number-format") is deliberate, so it's easy to re-point at that module later.
 *
 * Ratchet: a NEW `Intl.NumberFormat` call outside the allow-list fails the sweep.
 */
import { describe, expect, it } from 'vitest'
import { findIntlNumberFormat, listFiles, loadSourceFile, toRel } from './walk'

type AllowEntry = { file: string; reason: string }

const ALLOWLIST: AllowEntry[] = [
  {
    file: 'apps/admin/src/components/abandoned/abandoned-tiles.tsx',
    reason: 'local INR formatter — pending shared money module',
  },
  {
    file: 'apps/admin/src/components/collections/collection-tiles.tsx',
    reason: 'local INR formatter — pending shared money module',
  },
  {
    file: 'apps/admin/src/components/customers/customer-tiles.tsx',
    reason: 'local INR formatter — pending shared money module',
  },
  {
    file: 'apps/admin/src/components/discounts/discount-tiles.tsx',
    reason: 'local INR formatter — pending shared money module',
  },
  {
    file: 'apps/admin/src/components/gift-cards/gift-card-tiles.tsx',
    reason: 'local INR formatter — pending shared money module',
  },
  {
    file: 'apps/admin/src/components/home/insights-list.tsx',
    reason: 'local INR formatter — pending shared money module',
  },
  {
    file: 'apps/admin/src/components/inventory/inventory-columns.tsx',
    reason: 'local INR formatter — pending shared money module',
  },
  {
    file: 'apps/admin/src/components/inventory/inventory-tiles.tsx',
    reason: 'local INR formatter — pending shared money module',
  },
  {
    file: 'apps/admin/src/components/layout/count-up.tsx',
    reason: 'local number formatter for the animated counter — pending shared money module',
  },
  {
    file: 'apps/admin/src/components/marketing/automations/automation-editor.tsx',
    reason: 'local INR formatter — pending shared money module',
  },
  {
    file: 'apps/admin/src/components/marketing/automations/automations-page.tsx',
    reason: 'local INR formatter — pending shared money module',
  },
  {
    file: 'apps/admin/src/components/marketing/campaigns/campaign-report.tsx',
    reason: 'local INR formatter — pending shared money module',
  },
  {
    file: 'apps/admin/src/components/marketing/campaigns/campaign-tiles.tsx',
    reason: 'local INR formatter — pending shared money module',
  },
  {
    file: 'apps/admin/src/components/marketing/campaigns/campaigns-page.tsx',
    reason: 'local INR formatter — pending shared money module',
  },
  {
    file: 'apps/admin/src/components/marketing/channel-table-card.tsx',
    reason: 'local INR formatter — pending shared money module',
  },
  {
    file: 'apps/admin/src/components/marketing/top-campaigns-card.tsx',
    reason: 'local INR formatter — pending shared money module',
  },
  {
    file: 'apps/admin/src/components/purchase-orders/purchase-order-tiles.tsx',
    reason: 'local INR formatter — pending shared money module',
  },
  {
    file: 'apps/admin/src/components/transfers/transfer-columns.tsx',
    reason: 'local INR formatter — pending shared money module',
  },
  {
    file: 'apps/admin/src/lib/analytics-range.ts',
    reason: 'local number formatter for analytics ranges — pending shared money module',
  },
  {
    file: 'apps/admin/src/lib/money.ts',
    reason: 'the admin app’s own INR money helper, predates a shared package-level module',
  },
  {
    file: 'apps/admin/src/lib/report-format.ts',
    reason: 'local number/INR formatters for CSV report export — pending shared money module',
  },
  {
    file: 'apps/storefront/src/lib/money.ts',
    reason: 'the storefront app’s own INR money helper, predates a shared package-level module',
  },
  {
    file: 'packages/blocks/src/money.ts',
    reason: 'blocks’ own INR money helper, predates a shared package-level module',
  },
  {
    file: 'packages/core/src/gift-cards/products.ts',
    reason: 'local INR formatter for a generated gift-card product title',
  },
  {
    file: 'packages/core/src/gift-cards/service.ts',
    reason: 'local INR formatter for a gift-card email/notification amount',
  },
  {
    file: 'packages/core/src/marketing/send.ts',
    reason: 'local INR formatter for a marketing email amount',
  },
  {
    file: 'packages/core/src/notifications/deliver.ts',
    reason: 'local INR formatter for notification templates',
  },
  {
    file: 'packages/core/src/preorder/balance.ts',
    reason: 'local INR formatter for a preorder balance notice',
  },
  {
    file: 'packages/invoices/src/money.ts',
    reason:
      'invoices’ own INR money helper (GST documents), predates a shared package-level module',
  },
]

function isAllowlisted(file: string): boolean {
  return ALLOWLIST.some((e) => e.file === file)
}

async function findViolations(): Promise<string[]> {
  const files = await listFiles(['apps', 'packages'], { includeTests: false })
  const out: string[] = []
  for (const f of files) {
    const rel = toRel(f)
    const sf = loadSourceFile(f)
    if (findIntlNumberFormat(sf).length > 0) out.push(rel)
  }
  return out
}

describe('sweep: money-format', () => {
  it('every Intl.NumberFormat call site is allow-listed with a reason', async () => {
    const violations = await findViolations()
    const unlisted = violations.filter((v) => !isAllowlisted(v))
    expect(unlisted, `new Intl.NumberFormat call site:\n${unlisted.join('\n')}`).toEqual([])
  })

  it('the allow-list has no stale entries', async () => {
    const violations = await findViolations()
    const stale = ALLOWLIST.filter((e) => !violations.includes(e.file))
    expect(stale).toEqual([])
  })
})
