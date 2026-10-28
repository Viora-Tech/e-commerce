import 'server-only'
import type { CheckoutLook } from '@commerce/core'
import { liveLiquidLogoUrl } from './inbox-logo'

/**
 * The checkout's look with the store's logo: Settings → Checkout → Branding's, then our theme's
 * (both in `storeCheckoutLook`), then the logo an imported Shopify theme keeps in its own header
 * settings. Without the last, a store on an imported theme showed its name in plain type.
 */
export async function withThemeLogo(storeId: string, look: CheckoutLook): Promise<CheckoutLook> {
  if (look.logoUrl) return look
  return { ...look, logoUrl: await liveLiquidLogoUrl(storeId) }
}
