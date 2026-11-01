import type { RolloutMarketOption, RolloutThemeOption } from '@commerce/core'
import type { CheckoutBranding } from '@commerce/core/checkout-settings'

/** What the rollout page picks from, loaded by its server page. */
export type RolloutPageData = {
  /** The theme library, the live theme first. */
  themes: RolloutThemeOption[]
  /** The checkout as it is now; null when the member cannot read Settings. */
  checkout: { branding: CheckoutBranding; orderNotes: boolean; storeName: string } | null
  /** The store's markets, where an A/B test can be limited to; none without markets. */
  markets: RolloutMarketOption[]
}
