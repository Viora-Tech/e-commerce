/** SOURCE OF TRUTH: where the Loyalty app shows on the storefront — WHAT: the app embeds (site-wide) and app blocks (placed in a template) the Placements page lists, their theme types, and whether the live theme has an embed on / WHY: the storefront widgets register these same types, and the Placements page reads the live theme's app embed switches to say Ready or Off */

export type PlacementId = 'widget' | 'productPoints' | 'cardPoints' | 'cartRedeem' | 'referralPopup'

export type Placement = {
  id: PlacementId
  /** `embed`: switched on in Customize › App embeds. `block`: added to a template in Customize. */
  kind: 'embed' | 'block'
  /** The theme type the storefront registers (`<pluginId>/<Name>`). */
  type: string
}

export const LOYALTY_PLACEMENTS: readonly Placement[] = [
  { id: 'widget', kind: 'embed', type: 'loyalty/Widget' },
  { id: 'productPoints', kind: 'block', type: 'loyalty/ProductPoints' },
  { id: 'cardPoints', kind: 'block', type: 'loyalty/ProductCardPoints' },
  { id: 'cartRedeem', kind: 'block', type: 'loyalty/CartRedeem' },
  { id: 'referralPopup', kind: 'embed', type: 'loyalty/ReferralPopup' },
]

export type PlacementStatus = 'ready' | 'off' | 'unknown'

/**
 * An embed is Ready when the live theme has it switched on, Off when not; a block's place is in
 * the templates, so its status is not known here.
 */
export function placementStatus(
  p: Placement,
  appEmbeds: Record<string, { enabled: boolean }> | null,
): PlacementStatus {
  if (p.kind === 'block' || appEmbeds === null) return 'unknown'
  return appEmbeds[p.type]?.enabled ? 'ready' : 'off'
}

/**
 * Customize for a theme, opened on a rail panel (`apps`: App embeds; `sections`: the blocks). An
 * embed's type switches it on there, unsaved, with a "Click Save" hint (`EmbedSaveHint`).
 */
export function customizeHref(editorPath: string, kind: Placement['kind'], embed?: string): string {
  if (kind === 'embed' && embed)
    return `${editorPath}?panel=apps&embed=${encodeURIComponent(embed)}`
  return `${editorPath}?panel=${kind === 'embed' ? 'apps' : 'sections'}`
}

/** A page the program adds to the store, switched in the Loyalty settings (`settings.pages`). */
export type LoyaltyPageId = 'landing' | 'account' | 'accountStatus'

export type LoyaltyPage = {
  id: LoyaltyPageId
  /** The Placements section it is listed under. */
  section: 'embedded' | 'accounts'
  /** Where it shows on the storefront. */
  path: string
}

export const LOYALTY_PAGES: readonly LoyaltyPage[] = [
  { id: 'landing', section: 'embedded', path: '/pages/rewards' },
  { id: 'account', section: 'accounts', path: '/account/points' },
  { id: 'accountStatus', section: 'accounts', path: '/account' },
]

/**
 * The product line and the cart box come with the floating widget (it injects them above Add
 * to cart and Checkout), so their status is the widget embed's; the app blocks only move them.
 */
export function placementEmbedType(p: Placement): string | null {
  if (p.kind === 'embed') return p.type
  if (p.id === 'productPoints' || p.id === 'cartRedeem') return 'loyalty/Widget'
  return null
}
