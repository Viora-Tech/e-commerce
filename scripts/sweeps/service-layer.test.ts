/**
 * Sweep: direct `@commerce/db` / `drizzle-orm` value-imports are only allowed in the
 * service layer (`packages/core`, `packages/db`, `packages/api/src/services`) and in
 * one-off scripts. Everywhere else — app routes, the worker, plugin packages — should
 * read/write through a core service instead of the raw db client.
 *
 * This sweep is a ratchet: it fails on any NEW file outside those roots that imports
 * `@commerce/db` or `drizzle-orm` as a value, but does not fail on today's existing
 * ones — those are frozen in ALLOWLIST below, each with a reason. Fixing a violation
 * means moving the query behind a `packages/core` (or `packages/api/src/services`)
 * function; allow-listing it means adding a folder/file entry here with why it's OK
 * for now. See docs/guardrails.md.
 */
import { describe, expect, it } from 'vitest'
import { listFiles, loadSourceFile, parseImports, toRel } from './walk'

const ALLOWED_ROOTS = [
  'packages/core/src/',
  'packages/db/',
  'packages/api/src/services/',
  'scripts/',
]

/**
 * One entry per file since 2026-10-01 (folder entries were replaced, so a new file in an
 * already listed folder fails too). Prefix entries (`exact` unset) still work if ever needed.
 */
type AllowEntry = { path: string; exact?: boolean; reason: string }

const STOREFRONT_PAGE =
  'storefront RSC page/route reads the db directly — move behind a core service'
const STOREFRONT_LIB =
  'storefront lib helper or server action reads the db directly — move behind a core service'
const WORKER = 'worker job reads/writes the db directly; not yet routed through core services'
const PLUGIN = 'plugin owns its own schema/queries; not yet routed through packages/core'

const ALLOWLIST: AllowEntry[] = [
  {
    path: 'packages/auth/src/step-up.ts',
    exact: true,
    reason:
      "step-up re-auth (A5) stamps Better Auth's own session, passkey and verification tables, which the auth package owns (platform-level, no RLS)",
  },
  {
    path: 'apps/admin/src/app/api/health/route.ts',
    exact: true,
    reason:
      'infra liveness/readiness probe (Docker HEALTHCHECK) — deliberately a raw connectivity check, not a service call',
  },
  {
    path: 'apps/admin/src/app/api/uploads/route.ts',
    exact: true,
    reason: 'legacy direct read in an upload route handler — move behind a core service',
  },
  {
    path: 'apps/admin/src/lib/db.ts',
    exact: true,
    reason: 'creates the Db connection for the admin app request context',
  },
  { path: 'apps/storefront/src/app/-c/[storeId]/page.tsx', exact: true, reason: STOREFRONT_PAGE },
  { path: 'apps/storefront/src/app/-p/[storeId]/page.tsx', exact: true, reason: STOREFRONT_PAGE },
  {
    path: 'apps/storefront/src/app/-s/[storeId]/account/(signed-in)/orders/[number]/page.tsx',
    exact: true,
    reason: STOREFRONT_PAGE,
  },
  {
    path: 'apps/storefront/src/app/-s/[storeId]/checkout/balance/[token]/page.tsx',
    exact: true,
    reason: STOREFRONT_PAGE,
  },
  {
    path: 'apps/storefront/src/app/-s/[storeId]/checkout/pay/[number]/page.tsx',
    exact: true,
    reason: STOREFRONT_PAGE,
  },
  {
    path: 'apps/storefront/src/app/-s/[storeId]/checkout/thank-you/[number]/page.tsx',
    exact: true,
    reason: STOREFRONT_PAGE,
  },
  {
    path: 'apps/storefront/src/app/-s/[storeId]/documents/[id]/route.ts',
    exact: true,
    reason: STOREFRONT_PAGE,
  },
  { path: 'apps/storefront/src/app/-s/[storeId]/layout.tsx', exact: true, reason: STOREFRONT_PAGE },
  {
    path: 'apps/storefront/src/app/-s/[storeId]/llms.txt/route.ts',
    exact: true,
    reason: STOREFRONT_PAGE,
  },
  { path: 'apps/storefront/src/app/-s/[storeId]/page.tsx', exact: true, reason: STOREFRONT_PAGE },
  {
    path: 'apps/storefront/src/app/-s/[storeId]/pages/[handle]/page.tsx',
    exact: true,
    reason: STOREFRONT_PAGE,
  },
  {
    path: 'apps/storefront/src/app/-s/[storeId]/products/[handle]/page.tsx',
    exact: true,
    reason: STOREFRONT_PAGE,
  },
  { path: 'apps/storefront/src/app/api/health/route.ts', exact: true, reason: STOREFRONT_PAGE },
  { path: 'apps/storefront/src/lib/account.ts', exact: true, reason: STOREFRONT_LIB },
  { path: 'apps/storefront/src/lib/plain-html/render.ts', exact: true, reason: STOREFRONT_LIB },
  { path: 'apps/storefront/src/lib/back-in-stock-context.ts', exact: true, reason: STOREFRONT_LIB },
  { path: 'apps/storefront/src/lib/balance-actions.ts', exact: true, reason: STOREFRONT_LIB },
  { path: 'apps/storefront/src/lib/payment-actions.ts', exact: true, reason: STOREFRONT_LIB },
  { path: 'apps/storefront/src/lib/catalog.ts', exact: true, reason: STOREFRONT_LIB },
  { path: 'apps/storefront/src/lib/collections.ts', exact: true, reason: STOREFRONT_LIB },
  {
    path: 'apps/storefront/src/lib/db.ts',
    exact: true,
    reason: 'creates the Db connection for the storefront app request context',
  },
  { path: 'apps/storefront/src/lib/emi-offers.ts', exact: true, reason: STOREFRONT_LIB },
  { path: 'apps/storefront/src/lib/forms-context.ts', exact: true, reason: STOREFRONT_LIB },
  { path: 'apps/storefront/src/lib/login-actions.ts', exact: true, reason: STOREFRONT_LIB },
  {
    path: 'apps/storefront/src/lib/market-switch.ts',
    exact: true,
    reason:
      'the theme country selector form action reads the store markets — move behind a core service',
  },
  {
    path: 'apps/storefront/src/lib/market-catalog.ts',
    exact: true,
    reason:
      'opens its own withStore for storeMarketCatalogs (core): inStore asks this module for the catalog, so it cannot go through inStore itself',
  },
  { path: 'apps/storefront/src/lib/media-lookup.ts', exact: true, reason: STOREFRONT_LIB },
  { path: 'apps/storefront/src/lib/password-actions.ts', exact: true, reason: STOREFRONT_LIB },
  { path: 'apps/storefront/src/lib/payments.ts', exact: true, reason: STOREFRONT_LIB },
  { path: 'apps/storefront/src/lib/preorder.ts', exact: true, reason: STOREFRONT_LIB },
  { path: 'apps/storefront/src/lib/privacy-actions.ts', exact: true, reason: STOREFRONT_LIB },
  { path: 'apps/storefront/src/lib/redirects.ts', exact: true, reason: STOREFRONT_LIB },
  { path: 'apps/storefront/src/lib/seo-files.ts', exact: true, reason: STOREFRONT_LIB },
  { path: 'apps/storefront/src/lib/shipping.ts', exact: true, reason: STOREFRONT_LIB },
  { path: 'apps/storefront/src/lib/store-context.ts', exact: true, reason: STOREFRONT_LIB },
  { path: 'apps/storefront/src/lib/storefront-gate.ts', exact: true, reason: STOREFRONT_LIB },
  {
    path: 'apps/storefront/src/proxy.ts',
    exact: true,
    reason: 'resolves the store from the db in middleware — move behind a core service',
  },
  {
    path: 'apps/admin/src/app/api/channels/[provider]/callback/route.ts',
    exact: true,
    reason:
      'sales-channel OAuth callback opens withStore for the core connect call — no raw query, only the tx',
  },
  {
    path: 'apps/storefront/src/lib/liquid-theme.ts',
    exact: true,
    reason: STOREFRONT_LIB,
  },
  {
    path: 'apps/storefront/src/lib/track-order-actions.ts',
    exact: true,
    reason: STOREFRONT_LIB,
  },
  { path: 'apps/storefront/src/lib/chat-track-actions.ts', exact: true, reason: STOREFRONT_LIB },
  { path: 'apps/storefront/src/lib/related.ts', exact: true, reason: STOREFRONT_LIB },
  { path: 'apps/worker/src/api-activity.ts', exact: true, reason: WORKER },
  { path: 'apps/worker/src/store-activity.ts', exact: true, reason: WORKER },
  { path: 'apps/worker/src/shopify-token-sweep.ts', exact: true, reason: WORKER },
  { path: 'apps/worker/src/channel-sync.ts', exact: true, reason: WORKER },
  {
    path: 'apps/worker/src/media-rehost.ts',
    exact: true,
    reason: 'one-off repair CLI (media:rehost) run from the worker image, like a script',
  },
  {
    path: 'packages/api/src/mcp/oauth.ts',
    exact: true,
    reason:
      'MCP OAuth endpoints resolve the store and open withStore before calling core api-access',
  },
  {
    path: 'packages/api/src/mcp/server.ts',
    exact: true,
    reason: 'MCP transport opens withStore per request; queries live in services/core',
  },
  {
    path: 'packages/api/src/mcp/tools.ts',
    exact: true,
    reason: 'MCP tools open withStore and call services; no raw queries',
  },
  {
    path: 'packages/api/src/mcp/admin-actions.ts',
    exact: true,
    reason: 'MCP runAction opens withStore to log activity and queue approvals; no raw queries',
  },
  { path: 'apps/worker/src/app-events.ts', exact: true, reason: WORKER },
  { path: 'apps/worker/src/back-in-stock.ts', exact: true, reason: WORKER },
  {
    path: 'apps/worker/src/import-snapshots.ts',
    exact: true,
    reason:
      'worker sweep lists stores through a SECURITY DEFINER helper (ids only), like preorder-balance',
  },
  { path: 'apps/worker/src/index.ts', exact: true, reason: WORKER },
  { path: 'apps/worker/src/marketing.ts', exact: true, reason: WORKER },
  { path: 'apps/worker/src/media-process.ts', exact: true, reason: WORKER },
  { path: 'apps/worker/src/media-reprocess.ts', exact: true, reason: WORKER },
  { path: 'apps/worker/src/member-daily-summary.ts', exact: true, reason: WORKER },
  { path: 'apps/worker/src/notifications.ts', exact: true, reason: WORKER },
  { path: 'apps/worker/src/outbox-relay.ts', exact: true, reason: WORKER },
  {
    path: 'apps/worker/src/payment-fees.ts',
    exact: true,
    reason:
      'fee sync lists stores through a SECURITY DEFINER helper (ids only) and reads the store payment settings to resolve gateways, like payments-expiry; the payment queries live in core payments/charges.ts',
  },
  {
    path: 'apps/worker/src/payment-fees-backfill.ts',
    exact: true,
    reason: 'one-off command: opens the db and lists stores (ids only), then calls payment-fees.ts',
  },
  { path: 'apps/worker/src/payments-expiry.ts', exact: true, reason: WORKER },
  { path: 'apps/worker/src/payments.ts', exact: true, reason: WORKER },
  { path: 'apps/worker/src/preorder-balance.ts', exact: true, reason: WORKER },
  {
    path: 'apps/worker/src/affiliates.ts',
    exact: true,
    reason: 'worker sweep lists stores through a SECURITY DEFINER helper (ids only), like reviews',
  },
  {
    path: 'apps/worker/src/reviews.ts',
    exact: true,
    reason:
      'worker sweep lists stores through a SECURITY DEFINER helper (ids only), like import-snapshots',
  },
  { path: 'apps/worker/src/shipments-webhook.ts', exact: true, reason: WORKER },
  { path: 'apps/worker/src/shipping.ts', exact: true, reason: WORKER },
  { path: 'apps/worker/src/order-push.ts', exact: true, reason: WORKER },
  { path: 'apps/worker/src/store-export.ts', exact: true, reason: WORKER },
  { path: 'apps/worker/src/home-cards.ts', exact: true, reason: WORKER },
  { path: 'apps/worker/src/review-summaries.ts', exact: true, reason: WORKER },
  { path: 'apps/worker/src/theme-screenshot.ts', exact: true, reason: WORKER },
  {
    path: 'packages/api/src/procedures/store.ts',
    exact: true,
    reason: 'resolves the store from the db in an oRPC procedure — not yet a service',
  },
  { path: 'packages/plugin-back-in-stock/src/eligibility.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-back-in-stock/src/notify.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-back-in-stock/src/quota.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-back-in-stock/src/schema.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-back-in-stock/src/settings.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-back-in-stock/src/signups.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-back-in-stock/src/stock.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-back-in-stock/src/plugin.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-back-in-stock/src/restock-tags.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-chatwoot/src/server.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-affiliates/src/affiliates.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-affiliates/src/blocklist.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-affiliates/src/codes.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-affiliates/src/creatives.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-affiliates/src/enrol.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-affiliates/src/commissions.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-affiliates/src/commission-edit.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-affiliates/src/emails.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-affiliates/src/match.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-affiliates/src/payouts.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-affiliates/src/portal.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-affiliates/src/programs.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-affiliates/src/schema.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-affiliates/src/secrets.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-affiliates/src/stats.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-affiliates/src/store-settings.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-affiliates/src/tds-report.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-forms/src/messages.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-meilisearch/src/server.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-forms/src/schema.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-forms/src/plugin.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-growthbook/src/schema.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-growthbook/src/server.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-reviews/src/judgeme.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-reviews/src/photos.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-reviews/src/requests.ts', exact: true, reason: PLUGIN },
  {
    path: 'packages/plugin-reviews/src/review-list-where.ts',
    exact: true,
    reason:
      "the Reviews list's WHERE builder, split out of reviews.ts (filters F5); same plugin-owned review tables, which packages/core cannot import",
  },
  { path: 'packages/plugin-reviews/src/reviews.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-reviews/src/schema.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-reviews/src/past-orders.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-reviews/src/plugin.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-reviews/src/qr.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-reviews/src/questions.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-reviews/src/rewards.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-reviews/src/summary.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-reviews/src/widgets.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-reviews/src/store-settings.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-reviews/src/storefront.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-reviews/src/submit.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-gst-invoices/src/credit-notes.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-gst-invoices/src/issue.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-gst-invoices/src/links.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-gst-invoices/src/next-number.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-gst-invoices/src/numbers.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-gst-invoices/src/order-edit.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-gst-invoices/src/parcels.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-gst-invoices/src/periods.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-gst-invoices/src/plugin.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-gst-invoices/src/queue.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-gst-invoices/src/refund-allocation.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-gst-invoices/src/registration.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-gst-invoices/src/render.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-gst-invoices/src/reports.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-gst-invoices/src/returns.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-gst-invoices/src/schema.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-gst-invoices/src/vouchers.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/app-webhooks.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/connection.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/media.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/references.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/write-discounts.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/write-gift-cards.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/write-store-credit.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/write-metaobjects.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/run.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/traffic.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/runtime.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/schema.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/service.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/issue-groups.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/preflight.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/snapshot.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/status.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/write-content.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/write-customers.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/write-orders.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/write-products.ts', exact: true, reason: PLUGIN },
  { path: 'packages/plugin-shopify-import/src/settings-import.ts', exact: true, reason: PLUGIN },
  {
    path: 'packages/plugin-shopify-import/src/settings-import-stock.ts',
    exact: true,
    reason: PLUGIN,
  },
  {
    path: 'packages/plugin-shopify-import/src/settings-import-load.ts',
    exact: true,
    reason: PLUGIN,
  },
  {
    path: 'packages/plugin-shopify-import/test/helpers.ts',
    exact: true,
    reason: 'test helper seeds the db directly',
  },
  {
    path: 'packages/plugin-reviews/test/helpers.ts',
    exact: true,
    reason: 'test helper seeds the db directly',
  },
]

function isAllowlisted(rel: string): boolean {
  return ALLOWLIST.some((e) => (e.exact ? rel === e.path : rel.startsWith(e.path)))
}

async function findViolations(): Promise<string[]> {
  const files = await listFiles(['apps', 'packages'], { includeTests: false })
  const violations: string[] = []
  for (const file of files) {
    const rel = toRel(file)
    if (ALLOWED_ROOTS.some((root) => rel.startsWith(root))) continue
    const sf = loadSourceFile(file)
    const hits = parseImports(sf).some(
      (imp) =>
        imp.hasValue &&
        (imp.specifier === '@commerce/db' || imp.specifier.startsWith('drizzle-orm')),
    )
    if (hits) violations.push(rel)
  }
  return violations.sort()
}

describe('sweep: service-layer', () => {
  it('every @commerce/db / drizzle-orm value-import outside the service layer is allow-listed', async () => {
    const violations = await findViolations()
    const unlisted = violations.filter((v) => !isAllowlisted(v))
    expect(
      unlisted,
      `new direct db access outside the service layer:\n${unlisted.join('\n')}`,
    ).toEqual([])
  })

  it('the allow-list has no stale entries (every entry still matches a real violation)', async () => {
    const violations = await findViolations()
    const staleExact = ALLOWLIST.filter((e) => e.exact && !violations.includes(e.path))
    const stalePrefix = ALLOWLIST.filter(
      (e) => !e.exact && !violations.some((v) => v.startsWith(e.path)),
    )
    expect([...staleExact, ...stalePrefix]).toEqual([])
  })
})
