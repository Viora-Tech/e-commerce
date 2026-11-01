/** SOURCE OF TRUTH: storefront product views for browse abandonment — WHAT: records that a known shopper (signed in, or a basket whose contact is a customer) looked at a product page / WHY: the "Browse abandoned" automations need it (audit #183); called from the page-view beacon after the response, so the product page never waits on it */
import 'server-only'
import { settingsSecret } from '@commerce/config'
import { customerForSession, recordProductView } from '@commerce/core'
import { logger } from '@commerce/observability/logging'
import { inStore } from './store-context'

export async function recordShopperProductView(input: {
  storeId: string
  handle: string
  /** The `wc_customer` session token, when the shopper is signed in. */
  customerToken: string | null
  cartId: string | null
}): Promise<void> {
  if (!input.customerToken && !input.cartId) return
  const secret = settingsSecret()
  try {
    await inStore(input.storeId, async (tx) => {
      const ctx = { storeId: input.storeId, tx }
      const me = input.customerToken
        ? await customerForSession(ctx, input.customerToken, secret)
        : null
      await recordProductView(ctx, {
        customerId: me?.id ?? null,
        cartId: input.cartId,
        handle: input.handle,
        secret,
      })
    })
  } catch (err) {
    // A lost view costs one nudge at most, never the page.
    logger.warn('could not record the product view', { storeId: input.storeId, error: err })
  }
}
