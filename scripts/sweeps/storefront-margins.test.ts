/**
 * Sweep: margin utilities in the storefront (`mx-auto`, `my-16`, `mb-2`, `-mt-1`…) never apply.
 * Tailwind v4 puts every utility in `@layer utilities`, and an unlayered rule beats a layered one
 * whatever its specificity. Every storefront page carries an unlayered `* { margin: 0 }`: our
 * blocks' `base.css` reset, and on an imported Shopify theme the theme's own `base.css` copy of
 * it. So a margin utility is silently zeroed on every theme, which left the unsubscribe,
 * newsletter-confirm and review-email cards stuck to the top-left under the header and the policy
 * date over its title (15 Nov 2026).
 *
 * Rule: lay storefront UI out with flex/grid `gap`, padding and `justify-center`
 * (`components/system/system-panel.tsx`), or write the margin important (`mx-auto!`), which
 * beats an unlayered normal declaration.
 *
 * Ratchet: the files listed below predate the sweep. Their margins are dead today and the pages
 * were reviewed that way, so reviving them (adding `!`) changes a reviewed layout; fix one when
 * you next work on that screen and drop its entry. A listed file may not gain more.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { listFiles, toRel } from './walk'

const SCOPE_ROOTS = ['apps/storefront/src']

/** A margin or space-between utility with any variants, not marked important. */
const MARGIN_UTILITY = /^(?:[\w-]+:|\[[^\]]+\]:)*-?(?:m[xytblrse]?|space-[xy])-[^\s!]+$/

/** The margin utilities a source file writes without `!`; comments (which explain them) skipped. */
function deadMargins(source: string): string[] {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|\s)\/\/.*$/gm, ' ')
    .split(/[\s"'`{}()]+/)
    .filter((token) => MARGIN_UTILITY.test(token) && !token.startsWith('!'))
}

const LEGACY =
  'margin utilities that predate the sweep; dead today, the screen was reviewed without them'

const CHECKOUT =
  'locked checkout piece: margins dead under our own blocks reset; revive with `!` in a checkout pass'

const ALLOWLIST: Record<string, { count: number; reason: string }> = {
  'apps/storefront/src/app/-c/[storeId]/layout.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/app/-s/[storeId]/cart/cart-contents.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/app/-s/[storeId]/checkout/invoice/[token]/page.tsx': {
    count: 1,
    reason: CHECKOUT,
  },
  'apps/storefront/src/app/-s/[storeId]/checkout/pay/[number]/page.tsx': {
    count: 1,
    reason: CHECKOUT,
  },
  'apps/storefront/src/app/-s/[storeId]/checkout/pay/[number]/pay-client.tsx': {
    count: 1,
    reason: CHECKOUT,
  },
  'apps/storefront/src/components/account/account-code-step.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/components/account/address-book.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/components/account/order-detail.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/components/account/order-list.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/components/account/order-summary-card.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/components/account/return-photos.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/components/account/return-timeline.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/components/account/tracking-timeline.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/components/affiliate/affiliate-apply-form.tsx': { count: 3, reason: LEGACY },
  'apps/storefront/src/components/affiliate/creatives-list.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/components/affiliate/payouts-list.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/components/affiliate/program-terms.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/components/affiliate/range-stats.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/components/browse/browse-results.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/components/browse/filter-form.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/components/browse/sort-select.tsx': { count: 3, reason: LEGACY },
  'apps/storefront/src/components/checkout/checkout-address-fields.tsx': {
    count: 2,
    reason: CHECKOUT,
  },
  'apps/storefront/src/components/checkout/checkout-country-select.tsx': {
    count: 1,
    reason: CHECKOUT,
  },
  'apps/storefront/src/components/checkout/checkout-field.tsx': { count: 1, reason: CHECKOUT },
  'apps/storefront/src/components/checkout/checkout-form.tsx': { count: 1, reason: CHECKOUT },
  'apps/storefront/src/components/checkout/checkout-otp.tsx': { count: 1, reason: CHECKOUT },
  'apps/storefront/src/components/checkout/checkout-select.tsx': { count: 1, reason: CHECKOUT },
  'apps/storefront/src/components/checkout/checkout-stepper.tsx': { count: 1, reason: CHECKOUT },
  'apps/storefront/src/components/checkout/delivery-route-choices.tsx': {
    count: 2,
    reason: CHECKOUT,
  },
  'apps/storefront/src/components/checkout/saved-address-card.tsx': { count: 2, reason: CHECKOUT },
  'apps/storefront/src/components/checkout/store-credit-field.tsx': { count: 1, reason: CHECKOUT },
  'apps/storefront/src/components/checkout/thank-you-confirming.tsx': {
    count: 1,
    reason: CHECKOUT,
  },
  'apps/storefront/src/components/checkout/thank-you-delivery.tsx': { count: 1, reason: CHECKOUT },
  'apps/storefront/src/components/collections/main-collection.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/components/markets/market-suggestion.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/components/privacy/cookie-banner.tsx': { count: 2, reason: LEGACY },
  'apps/storefront/src/components/search/main-search.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/components/search/predictive-search.tsx': { count: 1, reason: LEGACY },
  'apps/storefront/src/components/theme/liquid-preorder-note.tsx': { count: 1, reason: LEGACY },
}

async function offenders(): Promise<Map<string, string[]>> {
  const found = new Map<string, string[]>()
  for (const file of await listFiles(SCOPE_ROOTS)) {
    if (!file.endsWith('.tsx')) continue
    const dead = deadMargins(readFileSync(file, 'utf8'))
    if (dead.length) found.set(toRel(file), dead)
  }
  return found
}

describe('sweep: storefront-margins', () => {
  it('finds layered margin utilities and accepts important ones', () => {
    expect(deadMargins('<div className="mx-auto my-16 md:my-24 p-6">')).toEqual([
      'mx-auto',
      'my-16',
      'md:my-24',
    ])
    expect(deadMargins('className={cn("-mt-1 ms-2 space-y-4", x)}')).toEqual([
      '-mt-1',
      'ms-2',
      'space-y-4',
    ])
    expect(deadMargins('<div className="mx-auto! !my-2 max-w-3xl min-h-4 mask-x-4">')).toEqual([])
    expect(deadMargins('// no mx-auto here\n{/* nor my-16 */}<a href="https://x">')).toEqual([])
  })

  it('no new margin utility in the storefront, and no listed file gains one', async () => {
    const found = await offenders()
    const fresh = [...found]
      .filter(([file, dead]) => dead.length > (ALLOWLIST[file]?.count ?? 0))
      .map(([file, dead]) => `${file}: ${dead.join(' ')}`)
    expect(fresh, 'use gap/padding/flex or `!` (see docs/guardrails.md)').toEqual([])
  })

  it('has no stale allow-list entries', async () => {
    const found = await offenders()
    const stale = Object.entries(ALLOWLIST)
      .filter(([file, { count }]) => (found.get(file)?.length ?? 0) < count)
      .map(([file]) => file)
    expect(stale, 'lower or remove the entry for each fixed file').toEqual([])
  })
})
