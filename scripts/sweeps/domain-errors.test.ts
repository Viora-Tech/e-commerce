/**
 * Sweep: typed domain errors. In core, the API and plugins a refusal the caller acts on is a
 * `CommerceError` (packages/core/src/errors.ts: a stable `code`, the store id, and the fields
 * the caller needs), so the API maps it to one typed answer and the admin narrows on the code,
 * never on message text. So:
 * 1. a NEW `class X extends Error` there must extend `CommerceError` (or a subclass) instead;
 * 2. routers (`packages/api/src/routers`) must not add bare `throw new Error(...)`: throw an
 *    `ORPCError` with a code, or let a core `CommerceError` through. Counted per file, so the
 *    count may only go down.
 *
 * Ratchet: new bare classes/throws fail; fixed ones must leave the allow-list (stale fails).
 */
import { describe, expect, it } from 'vitest'
import { bareErrorClasses, routerBareThrows } from './consistency'

type AllowEntry = { site: string; reason: string }

const MOVE =
  'predates the rule — extend CommerceError with a code (keep the class name so callers still match)'
const PLUGIN =
  'plugin-internal error, caught and translated inside the plugin — extend CommerceError when the plugin next changes'

const ALLOWLIST: AllowEntry[] = [
  { site: 'packages/api/src/services/discount.service.ts: DiscountCodeTaken', reason: MOVE },
  { site: 'packages/api/src/services/invitation.service.ts: InvitationError', reason: MOVE },
  { site: 'packages/api/src/services/taxes.service.ts: TaxesError', reason: MOVE },
  { site: 'packages/core/src/blog/schemas.ts: InvalidArticle', reason: MOVE },
  { site: 'packages/core/src/collections/schemas.ts: InvalidCollection', reason: MOVE },
  {
    site: 'packages/core/src/customer-accounts/service.ts: LoginMethodUnavailable',
    reason: MOVE,
  },
  {
    site: 'packages/core/src/customer-accounts/service.ts: LoginProviderNeedsSetup',
    reason: MOVE,
  },
  { site: 'packages/core/src/dynamic-sources/service.ts: InvalidBindings', reason: MOVE },
  {
    site: 'packages/core/src/errors.ts: CommerceError',
    reason: 'the base class itself',
  },
  { site: 'packages/core/src/inventory/stock.ts: NegativeStockError', reason: MOVE },
  { site: 'packages/core/src/marketing/campaigns.ts: CampaignLocked', reason: MOVE },
  { site: 'packages/core/src/marketing/campaigns.ts: CampaignNotReady', reason: MOVE },
  {
    site: 'packages/core/src/media/pipeline.ts: DecompressionBombError',
    reason: 'raised and caught inside the media pipeline (a decode guard), never reaches a caller',
  },
  {
    site: 'packages/core/src/metaobjects/schemas.ts: InvalidMetaobject',
    reason: 'CMS area is being changed by a parallel build — move after it merges',
  },
  { site: 'packages/core/src/privacy/requests.ts: DataRequestError', reason: MOVE },
  { site: 'packages/core/src/shipping/pickup.ts: PickupNotSupported', reason: MOVE },
  { site: 'packages/core/src/shopper-login/credentials.ts: LoginAppIncomplete', reason: MOVE },
  { site: 'packages/core/src/theme/custom-sections.ts: CustomSectionProblem', reason: MOVE },
  { site: 'packages/plugin-gst-invoices/src/issue.ts: InvoiceError', reason: PLUGIN },
  { site: 'packages/plugin-gst-invoices/src/periods.ts: PeriodError', reason: PLUGIN },
  { site: 'packages/plugin-shopify-import/src/bulk.ts: BulkUnavailableError', reason: PLUGIN },
  { site: 'packages/plugin-shopify-import/src/connection.ts: ConnectionError', reason: PLUGIN },
  { site: 'packages/plugin-shopify-import/src/oauth.ts: ShopifyOAuthError', reason: PLUGIN },
  { site: 'packages/plugin-shopify-import/src/service.ts: ImportError', reason: PLUGIN },
  { site: 'packages/plugin-shopify-import/src/shopify-client.ts: ShopifyError', reason: PLUGIN },
]

/** Bare `throw new Error(` per router file, as of the day the rule was added. */
const ROUTER_THROWS: Record<string, { count: number; reason: string }> = {
  'packages/api/src/routers/gift-cards.ts': {
    count: 1,
    reason: 'predates the rule — throw an ORPCError with a code',
  },
  'packages/api/src/routers/onboarding.ts': {
    count: 1,
    reason: 'predates the rule — throw an ORPCError with a code',
  },
}

describe('sweep: domain-errors', () => {
  it('error classes in core, api and plugins extend CommerceError', async () => {
    const sites = await bareErrorClasses()
    const unlisted = sites.filter((s) => !ALLOWLIST.some((e) => e.site === s))
    expect(unlisted, `extend CommerceError instead of Error:\n${unlisted.join('\n')}`).toEqual([])
  })

  it('the class allow-list has no stale entries', async () => {
    const sites = await bareErrorClasses()
    expect(ALLOWLIST.filter((e) => !sites.includes(e.site))).toEqual([])
  })

  it('routers add no bare throw new Error, and fixed ones lower their count', async () => {
    const counts = await routerBareThrows()
    const drift = Object.keys({ ...counts, ...ROUTER_THROWS })
      .filter((file) => (counts[file] ?? 0) !== (ROUTER_THROWS[file]?.count ?? 0))
      .map(
        (file) =>
          `${file}: ${counts[file] ?? 0} (allow-list says ${ROUTER_THROWS[file]?.count ?? 0})`,
      )
    expect(drift, 'update ROUTER_THROWS only downwards; new throws need an ORPCError').toEqual([])
  })
})
