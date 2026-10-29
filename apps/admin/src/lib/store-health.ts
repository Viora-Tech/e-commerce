import { appStoreUrl } from '@commerce/config/site'
import { INDIAN_STATE_NAMES } from '@commerce/core/states'
import type { HealthIssue, HealthSeverity } from '@commerce/core/store-health'
import type { ChipTone } from '@/components/status/tone'
import type { storeHealthContent } from '@/data/store-health'
import { routes } from '@/lib/routes'

type Copy = typeof storeHealthContent

/** How many state names a line spells out before "and N more". */
const STATES_SHOWN = 4

export type HealthLink = { href: string; external: boolean }

/** Where each problem gets fixed; couriers are apps, browsed on the App Store website. */
export function healthLink(issue: HealthIssue): HealthLink {
  const inside = (href: string): HealthLink => ({ href, external: false })
  const products = (q: string) => inside(`${routes.products.list()}?status=active&${q}`)
  switch (issue.code) {
    case 'zone_no_rates':
      return inside(routes.settings.shippingZone(issue.zoneId))
    case 'zones_overlap':
      return inside(routes.settings.shipping())
    case 'states_uncovered':
      return inside(routes.settings.newShippingZone())
    case 'no_origin_pincode':
      return inside(routes.settings.shipping())
    case 'no_courier':
      return { href: appStoreUrl({ category: 'shipping' }), external: true }
    case 'variants_no_weight':
      return products('missing=weight')
    case 'products_no_price':
      return products('priceMax=0')
    case 'products_no_image':
      return products('missing=image')
    case 'no_payment_method':
    case 'no_online_payment':
    case 'gateway_test_mode':
    case 'webhook_missing':
      return inside(routes.settings.payments())
    case 'policies_missing':
      return inside(routes.settings.policies())
    case 'sender_unverified':
    case 'no_sender_email':
      return inside(routes.settings.notifications())
  }
}

function stateList(codes: string[]): string {
  const names = codes.map((c) => INDIAN_STATE_NAMES[c] ?? c)
  if (names.length <= STATES_SHOWN) return names.join(', ')
  return `${names.slice(0, STATES_SHOWN).join(', ')} +${names.length - STATES_SHOWN}`
}

/** One problem in the member's words: its title, one line on why it matters, the fix button. */
export function healthText(
  issue: HealthIssue,
  copy: Copy,
): { title: string; body: string; fix: string } {
  const c = copy.issues
  switch (issue.code) {
    case 'zone_no_rates':
      return { ...c.zone_no_rates, title: c.zone_no_rates.title(issue.zoneName) }
    case 'zones_overlap':
      return { ...c.zones_overlap, title: c.zones_overlap.title(issue.zoneNames.join(', ')) }
    case 'states_uncovered':
      return {
        title: c.states_uncovered.title(issue.stateCodes.length),
        body: c.states_uncovered.body(stateList(issue.stateCodes)),
        fix: c.states_uncovered.fix,
      }
    case 'no_origin_pincode':
      return c.no_origin_pincode
    case 'no_courier':
      return c.no_courier
    case 'variants_no_weight':
      return {
        title: c.variants_no_weight.title(issue.variants),
        body: c.variants_no_weight.body(issue.products),
        fix: c.variants_no_weight.fix,
      }
    case 'products_no_price':
      return { ...c.products_no_price, title: c.products_no_price.title(issue.products) }
    case 'products_no_image':
      return { ...c.products_no_image, title: c.products_no_image.title(issue.products) }
    case 'no_payment_method':
      return c.no_payment_method
    case 'no_online_payment':
      return c.no_online_payment
    case 'gateway_test_mode':
      return { ...c.gateway_test_mode, title: c.gateway_test_mode.title(issue.gateway) }
    case 'webhook_missing':
      return {
        title: c.webhook_missing.title(issue.gateway),
        body: c.webhook_missing.body(issue.paid),
        fix: c.webhook_missing.fix,
      }
    case 'policies_missing':
      return {
        title: c.policies_missing.title(issue.policies.length),
        body: c.policies_missing.body(issue.policies.map((p) => copy.policyNames[p]).join(', ')),
        fix: c.policies_missing.fix,
      }
    case 'sender_unverified':
      return {
        title: c.sender_unverified.title(issue.email),
        body: c.sender_unverified.body(issue.status === 'failed'),
        fix: c.sender_unverified.fix,
      }
    case 'no_sender_email':
      return c.no_sender_email
  }
}

/** Chip tone per severity: red stops orders, amber hurts them, grey is a nudge. */
export const SEVERITY_TONE: Record<HealthSeverity, ChipTone> = {
  blocks_checkout: 'danger',
  should_fix: 'attention',
  nice_to_have: 'neutral',
}
