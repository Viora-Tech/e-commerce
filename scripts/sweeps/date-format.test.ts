/**
 * Sweep: date formatting outside `@commerce/dates`. `Intl.DateTimeFormat`,
 * `toLocaleDateString`, `toLocaleTimeString` and `toLocaleString(locale, options)` build date
 * text in whatever zone the runtime has; the server (UTC) and the browser (IST) then disagree
 * on the day and the text (a hydration error). The one home is `formatInZone` in
 * `@commerce/dates`, pinned to the store's zone; admin components reach it through
 * `useFormat()` (`date`, `dateTime`, `when`, `pattern`) or `lib/format-date.ts`.
 *
 * Ratchet: a NEW file formatting dates itself fails; moving one to the owner means deleting
 * its entry (stale entries fail).
 */
import { describe, expect, it } from 'vitest'
import { dateFormatSites } from './consistency'

type AllowEntry = { file: string; reason: string }

const ADMIN = 'admin screen not on the 2026-10-01 audit list — move to useFormat().pattern'
const ADMIN_LIB = 'admin lib/copy formatter — build it on formatPattern in lib/format-date.ts'
const CORE =
  'server-built text for emails, messages or exports — move to formatInZone from @commerce/dates'
const STOREFRONT = 'storefront date text — move to formatInZone with the store timezone'

const ALLOWLIST: AllowEntry[] = [
  { file: 'apps/admin/src/components/home/charts/sales-orders-chart.tsx', reason: ADMIN },
  { file: 'apps/admin/src/components/navigation/navigation-list.tsx', reason: ADMIN },
  { file: 'apps/admin/src/components/notifications/sender-email-card.tsx', reason: ADMIN },
  { file: 'apps/admin/src/components/orders/packing-slip.tsx', reason: ADMIN },
  { file: 'apps/admin/src/components/products/stock-history-card.tsx', reason: ADMIN },
  { file: 'apps/admin/src/data/hi/products.ts', reason: ADMIN_LIB },
  { file: 'apps/admin/src/data/products.ts', reason: ADMIN_LIB },
  { file: 'apps/admin/src/lib/analytics-range.ts', reason: ADMIN_LIB },
  { file: 'apps/admin/src/lib/report-format.ts', reason: ADMIN_LIB },
  { file: 'apps/storefront/src/components/checkout/balance-due.tsx', reason: STOREFRONT },
  { file: 'apps/storefront/src/data/account.ts', reason: STOREFRONT },
  { file: 'apps/storefront/src/data/policies.ts', reason: STOREFRONT },
  { file: 'packages/core/src/blog/text.ts', reason: CORE },
  { file: 'packages/core/src/gift-cards/client.ts', reason: CORE },
  { file: 'packages/core/src/gift-cards/service.ts', reason: CORE },
  { file: 'packages/core/src/notifications/deliver.ts', reason: CORE },
  { file: 'packages/core/src/payments/manual-followup.ts', reason: CORE },
  {
    file: 'packages/shipping/src/delivery-date.ts',
    reason:
      'delivery-date calendar does its own zone maths with Intl parts; move onto wallClock/dayKey from @commerce/dates',
  },
  {
    file: 'packages/ui/src/components/shadcn/calendar.tsx',
    reason: 'vendored shadcn calendar (react-day-picker captions) — not edited by hand',
  },
]

describe('sweep: date-format', () => {
  it('every file that formats dates itself is allow-listed with a reason', async () => {
    const files = await dateFormatSites()
    const unlisted = files.filter((f) => !ALLOWLIST.some((e) => e.file === f))
    expect(
      unlisted,
      `format dates with @commerce/dates (admin: useFormat()):\n${unlisted.join('\n')}`,
    ).toEqual([])
  })

  it('the allow-list has no stale entries', async () => {
    const files = await dateFormatSites()
    expect(ALLOWLIST.filter((e) => !files.includes(e.file))).toEqual([])
  })
})
