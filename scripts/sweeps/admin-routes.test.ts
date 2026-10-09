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
  'apps/admin/src/app/(admin)/apps/[pluginId]/[[...path]]/page.tsx': 2,
  'apps/admin/src/app/(admin)/content/blog-posts/blog-posts-page.tsx': 4,
  'apps/admin/src/app/(admin)/content/menus/page.tsx': 1,
  'apps/admin/src/app/(admin)/content/menus/redirects/page.tsx': 1,
  'apps/admin/src/app/(admin)/customers/[id]/page.tsx': 1,
  'apps/admin/src/app/(admin)/customers/customers-page.tsx': 1,
  'apps/admin/src/app/(admin)/customers/segments/[id]/page.tsx': 1,
  'apps/admin/src/app/(admin)/customers/segments/page.tsx': 2,
  'apps/admin/src/app/(admin)/dev/emails/[template]/page.tsx': 1,
  'apps/admin/src/app/(admin)/dev/emails/page.tsx': 1,
  'apps/admin/src/app/(admin)/discounts/[id]/page.tsx': 1,
  'apps/admin/src/app/(admin)/discounts/discounts-page.tsx': 2,
  'apps/admin/src/app/(admin)/online-store/blog/page.tsx': 1,
  'apps/admin/src/app/(admin)/online-store/page.tsx': 1,
  'apps/admin/src/app/(admin)/online-store/pages/[id]/page.tsx': 1,
  'apps/admin/src/app/(admin)/online-store/themes/[id]/import/page.tsx': 2,
  'apps/admin/src/app/(admin)/orders/[id]/page.tsx': 1,
  'apps/admin/src/app/(admin)/orders/drafts/drafts-page.tsx': 2,
  'apps/admin/src/app/(admin)/orders/orders-page.tsx': 5,
  'apps/admin/src/app/(admin)/orders/returns/[id]/page.tsx': 1,
  'apps/admin/src/app/(admin)/orders/returns/returns-page.tsx': 1,
  'apps/admin/src/app/(admin)/page.tsx': 1,
  'apps/admin/src/app/(admin)/select-store/select-store.tsx': 1,
  'apps/admin/src/app/(admin)/settings/shipping/zones/[id]/page.tsx': 1,
  'apps/admin/src/app/(auth)/login/page.tsx': 1,
  'apps/admin/src/app/(editor)/layout.tsx': 1,
  'apps/admin/src/app/onboarding/page.tsx': 1,
  'apps/admin/src/components/analytics/report-view.tsx': 1,
  'apps/admin/src/components/analytics/reports-list.tsx': 1,
  'apps/admin/src/components/analytics/top-products-card.tsx': 1,
  'apps/admin/src/components/apps/app-shell.tsx': 1,
  'apps/admin/src/components/apps/decentro/overview-page.tsx': 2,
  'apps/admin/src/components/apps/emi/settings-page.tsx': 1,
  'apps/admin/src/components/apps/gst-invoices/invoice-detail.tsx': 1,
  'apps/admin/src/components/apps/gst-invoices/invoices-list.tsx': 2,
  'apps/admin/src/components/apps/gst-invoices/queue-page.tsx': 2,
  'apps/admin/src/components/apps/messages/channel-connect-page.tsx': 1,
  'apps/admin/src/components/apps/reviews/import-page.tsx': 3,
  'apps/admin/src/components/apps/reviews/review-detail.tsx': 3,
  'apps/admin/src/components/apps/reviews/review-row-actions.tsx': 1,
  'apps/admin/src/components/apps/reviews/review-side-cards.tsx': 2,
  'apps/admin/src/components/apps/reviews/reviews-page.tsx': 3,
  'apps/admin/src/components/apps/reviews/settings-page.tsx': 1,
  'apps/admin/src/components/apps/shared/courier-shipments-link.tsx': 1,
  'apps/admin/src/components/apps/shared/provider-overview-page.tsx': 1,
  'apps/admin/src/components/blog/article-form.tsx': 2,
  'apps/admin/src/components/blog/blogs-manager.tsx': 1,
  'apps/admin/src/components/customers/customer-header.tsx': 2,
  'apps/admin/src/components/customers/customer-orders-card.tsx': 1,
  'apps/admin/src/components/customers/delete-segment-button.tsx': 1,
  'apps/admin/src/components/customers/segment-form.tsx': 1,
  'apps/admin/src/components/customers/segment-preview.tsx': 1,
  'apps/admin/src/components/customers/segments-list.tsx': 1,
  'apps/admin/src/components/discounts/discount-form.tsx': 2,
  'apps/admin/src/components/domains/domain-detail.tsx': 2,
  'apps/admin/src/components/domains/domains-settings.tsx': 2,
  'apps/admin/src/components/drafts/draft-form.tsx': 2,
  'apps/admin/src/components/growth/automations/automation-editor.tsx': 2,
  'apps/admin/src/components/growth/automations/automations-page.tsx': 1,
  'apps/admin/src/components/growth/campaigns/campaign-editor.tsx': 3,
  'apps/admin/src/components/growth/campaigns/campaign-report.tsx': 1,
  'apps/admin/src/components/growth/campaigns/campaign-settings-card.tsx': 1,
  'apps/admin/src/components/growth/campaigns/campaigns-page.tsx': 1,
  'apps/admin/src/components/growth/campaigns/discount-code-field.tsx': 1,
  'apps/admin/src/components/growth/campaigns/whatsapp-template-card.tsx': 1,
  'apps/admin/src/components/growth/growth-overview.tsx': 1,
  'apps/admin/src/components/home/live-order-stream.tsx': 1,
  'apps/admin/src/components/invitations/invitation-state-card.tsx': 1,
  'apps/admin/src/components/media/media-library.tsx': 1,
  'apps/admin/src/components/metaobjects/custom-data-settings.tsx': 1,
  'apps/admin/src/components/metaobjects/definition-form.tsx': 2,
  'apps/admin/src/components/metaobjects/definitions-page.tsx': 3,
  'apps/admin/src/components/metaobjects/entries-page.tsx': 1,
  'apps/admin/src/components/metaobjects/entry-form.tsx': 1,
  'apps/admin/src/components/metaobjects/new-content-type.tsx': 1,
  'apps/admin/src/components/navigation/menu-editor.tsx': 1,
  'apps/admin/src/components/navigation/navigation-list.tsx': 2,
  'apps/admin/src/components/notifications/advanced-section.tsx': 1,
  'apps/admin/src/components/notifications/message-row.tsx': 1,
  'apps/admin/src/components/online-store/page-form.tsx': 1,
  'apps/admin/src/components/online-store/pages-list.tsx': 1,
  'apps/admin/src/components/orders/customer-card.tsx': 1,
  'apps/admin/src/components/orders/order-actions.tsx': 2,
  'apps/admin/src/components/orders/order-header.tsx': 1,
  'apps/admin/src/components/orders/order-returns-card.tsx': 2,
  'apps/admin/src/components/payments/advanced-section.tsx': 1,
  'apps/admin/src/components/payments/gateway-connect-page.tsx': 1,
  'apps/admin/src/components/payments/gateway-overview-page.tsx': 1,
  'apps/admin/src/components/payments/main-gateway-card.tsx': 1,
  'apps/admin/src/components/preferences/preferences-form.tsx': 1,
  'apps/admin/src/components/privacy/data-request-detail.tsx': 2,
  'apps/admin/src/components/privacy/data-request-queue.tsx': 2,
  'apps/admin/src/components/returns/return-customer-card.tsx': 1,
  'apps/admin/src/components/returns/return-outcome-card.tsx': 2,
  'apps/admin/src/components/returns/return-view.tsx': 1,
  'apps/admin/src/components/settings/cod-rules-card.tsx': 1,
  'apps/admin/src/components/settings/courier-rule-fields.tsx': 1,
  'apps/admin/src/components/settings/customer-accounts-settings.tsx': 2,
  'apps/admin/src/components/settings/customer-privacy-settings.tsx': 3,
  'apps/admin/src/components/settings/locations/location-detail.tsx': 2,
  'apps/admin/src/components/settings/locations/locations-settings.tsx': 1,
  'apps/admin/src/components/settings/policies-settings.tsx': 1,
  'apps/admin/src/components/settings/policy-editor.tsx': 1,
  'apps/admin/src/components/settings/settings-home.tsx': 3,
  'apps/admin/src/components/settings/taxes/numbering-card.tsx': 2,
  'apps/admin/src/components/settings/taxes/registration-card.tsx': 1,
  'apps/admin/src/components/shipments/ndr-tab.tsx': 1,
  'apps/admin/src/components/shipments/no-courier-banner.tsx': 2,
  'apps/admin/src/components/shipments/ready-to-ship-tab.tsx': 1,
  'apps/admin/src/components/shipments/rto-tab.tsx': 2,
  'apps/admin/src/components/shipments/shipments-tab.tsx': 1,
  'apps/admin/src/components/shipping-settings/shipping-page.tsx': 1,
  'apps/admin/src/components/shipping-zones/shipping-zones-card.tsx': 1,
  'apps/admin/src/components/themes/current-theme-card.tsx': 1,
  'apps/admin/src/components/themes/customize/add-section-apps-tab.tsx': 1,
  'apps/admin/src/components/themes/customize/customize-top-bar.tsx': 1,
  'apps/admin/src/components/themes/customize/imported-theme-settings.tsx': 1,
  'apps/admin/src/components/themes/customize/link-target-rows.tsx': 1,
  'apps/admin/src/components/themes/customizer-top-bar.tsx': 1,
  'apps/admin/src/components/themes/theme-library-row.tsx': 2,
  'apps/admin/src/data/apps.ts': 4,
  'apps/admin/src/data/content.ts': 2,
  'apps/admin/src/data/customers.ts': 2,
  'apps/admin/src/data/discounts.ts': 2,
  'apps/admin/src/data/growth.ts': 7,
  'apps/admin/src/data/media.ts': 1,
  'apps/admin/src/data/orders.ts': 2,
  'apps/admin/src/data/policies.ts': 5,
  'apps/admin/src/data/provider-settings.ts': 1,
  'apps/admin/src/data/settings-search.ts': 46,
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
