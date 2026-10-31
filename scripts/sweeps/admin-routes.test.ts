/**
 * Sweep: hardcoded admin paths. Every admin URL lives once in `apps/admin/src/lib/routes.ts`
 * (`routes.orders.detail(id)`, `routes.settings.taxes()`); navigation, links and redirects read
 * from it, so a path moves in one place. A string literal path in an `href` or in `redirect` /
 * `push` / `replace` is a hardcoded one.
 *
 * Ratchet: the count per file may only go DOWN. A new hardcoded href (or one more in a listed
 * file) fails; migrating one to `routes` means lowering that file's number, and a file at zero
 * must leave the list (a stale entry fails too). Remaining pages are migrated by the page PRs
 * of the admin redesign (docs/handoff/changes/2026-10-10-proofly-shell.md).
 */
import { describe, expect, it } from 'vitest'
import { hardcodedAdminHrefs } from './consistency'

/** file -> hardcoded href count on the day the sweep was added (the TODO count). */
const ALLOWLIST: Record<string, number> = {
  'apps/admin/src/app/(admin)/content/menus/page.tsx': 1,
  'apps/admin/src/app/(admin)/content/menus/redirects/page.tsx': 1,
  'apps/admin/src/app/(admin)/dev/emails/[template]/page.tsx': 1,
  'apps/admin/src/app/(admin)/dev/emails/page.tsx': 1,
  'apps/admin/src/app/(admin)/discounts/[id]/page.tsx': 1,
  'apps/admin/src/app/(admin)/online-store/blog/page.tsx': 1,
  'apps/admin/src/app/(admin)/online-store/page.tsx': 1,
  'apps/admin/src/app/(admin)/online-store/pages/[id]/page.tsx': 1,
  'apps/admin/src/app/(admin)/orders/[id]/page.tsx': 1,
  'apps/admin/src/app/(admin)/orders/returns/[id]/page.tsx': 1,
  'apps/admin/src/app/(admin)/page.tsx': 1,
  'apps/admin/src/app/(admin)/select-store/select-store.tsx': 1,
  'apps/admin/src/app/(admin)/settings/shipping/zones/[id]/page.tsx': 1,
  'apps/admin/src/app/(editor)/layout.tsx': 1,
  'apps/admin/src/app/onboarding/page.tsx': 1,
  'apps/admin/src/components/analytics/top-products-card.tsx': 1,
  'apps/admin/src/components/apps/reviews/review-side-cards.tsx': 1,
  'apps/admin/src/components/apps/shared/courier-shipments-link.tsx': 1,
  'apps/admin/src/components/invitations/invitation-state-card.tsx': 1,
  'apps/admin/src/components/notifications/advanced-section.tsx': 1,
  'apps/admin/src/components/orders/order-actions.tsx': 2,
  'apps/admin/src/components/orders/order-returns-card.tsx': 2,
  'apps/admin/src/components/preferences/preferences-form.tsx': 1,
  'apps/admin/src/components/privacy/data-request-detail.tsx': 2,
  'apps/admin/src/components/privacy/data-request-queue.tsx': 2,
  'apps/admin/src/components/returns/return-outcome-card.tsx': 2,
  'apps/admin/src/components/shipments/ndr-tab.tsx': 1,
  'apps/admin/src/components/themes/customize/link-target-rows.tsx': 1,
  'apps/admin/src/components/themes/customizer-top-bar.tsx': 1,
  'apps/admin/src/data/apps.ts': 4,
  'apps/admin/src/data/media.ts': 1,
  'apps/admin/src/data/orders.ts': 2,
  'apps/admin/src/data/policies.ts': 5,
  'apps/admin/src/data/settings-search.ts': 29,
  'apps/admin/src/lib/auth-paths.ts': 1,
}

describe('sweep: admin-routes', () => {
  it('no new hardcoded admin hrefs (use routes from lib/routes.ts)', async () => {
    const found = await hardcodedAdminHrefs()
    const over = [...found.entries()]
      .filter(([file, n]) => n > (ALLOWLIST[file] ?? 0))
      .map(([file, n]) => `${file}: ${n} (allowed ${ALLOWLIST[file] ?? 0})`)
    expect(over, `use routes.* from apps/admin/src/lib/routes.ts:\n${over.join('\n')}`).toEqual([])
  })

  it('has no stale allow-list entries (lower the number or delete the row)', async () => {
    const found = await hardcodedAdminHrefs()
    const stale = Object.entries(ALLOWLIST)
      .filter(([file, n]) => (found.get(file) ?? 0) < n)
      .map(([file, n]) => `${file}: listed ${n}, now ${found.get(file) ?? 0}`)
    expect(stale).toEqual([])
  })
})
