/** SOURCE OF TRUTH: checkout refusals in the shopper's words — WHAT: the message for each error `placeOrder` throws that the shopper can fix (gift card, discount, shipping, price, hidden item, checkout rules), null for anything else / WHY: `checkoutAction` shows these on the form instead of failing the request */
import 'server-only'

import {
  CannotShipToState,
  CartLimitExceeded,
  CheckoutRuleViolation,
  DiscountCodeRefused,
  DiscountUnavailable,
  GiftCardError,
  NotSoldInMarket,
  PaymentMethodHidden,
  PreorderMixedCart,
  PriceNotSet,
  ShippingRateUnavailable,
  ShippingUnavailable,
  StoreCreditError,
  VariantHidden,
} from '@commerce/core'
import { formatMoney } from '@commerce/money'
import { discountFieldContent } from '@/data/cart'
import { checkoutContent } from '@/data/checkout'
import { deliveryOptionsContent } from '@/data/delivery-options'

/** The form's error for a refused order, or null when the error is not the shopper's to fix. */
export function checkoutErrorMessage(err: unknown, pincode: string): string | null {
  const e = checkoutContent.errors
  // Gift card rules (spent elsewhere, COD for the rest, a card in a mixed basket) are the shopper's to fix.
  if (err instanceof GiftCardError) return err.message
  // Store credit (cash on delivery for the rest, or not this shopper's order) is theirs to fix too.
  if (err instanceof StoreCreditError) return err.message
  // Another checkout took the last use of the code; the next submit prices without it.
  if (err instanceof DiscountUnavailable) return e.discountUnavailable
  // The code works for nobody with this email (one use each, customers only): say so, never charge more quietly.
  if (err instanceof DiscountCodeRefused) {
    return e.discountRefused(
      err.code,
      discountFieldContent.errors[err.reason] ?? discountFieldContent.errors.invalid ?? '',
    )
  }
  // Rates are the store's to set; the shopper can only change the address or re-pick.
  if (err instanceof ShippingUnavailable) return e.noShipping(pincode)
  // Only a composition-scheme warehouse holds it, and those cannot ship to another state.
  if (err instanceof CannotShipToState) return e.cannotShipToState
  if (err instanceof PriceNotSet) return e.priceNotSet
  // Hidden on the storefront after it went into the cart (#934).
  if (err instanceof VariantHidden) return e.variantHidden
  // The cart's market sells from a catalog that leaves it out (Markets › Catalogs).
  if (err instanceof NotSoldInMarket) return e.notSoldInMarket
  if (err instanceof ShippingRateUnavailable) return e.rateChanged
  // Settings → Checkout → Cart limit (#156).
  if (err instanceof CartLimitExceeded) return e.cartLimit(err.title, err.max)
  // A pre-order campaign keeps its pre-orders apart from in-stock items (#143).
  if (err instanceof PreorderMixedCart) return err.shopperMessage ?? e.preorderMixedCart
  // Settings → Payments → Payment rules (#150): this way to pay is not offered for this order.
  if (err instanceof PaymentMethodHidden) return e.paymentMethodHidden
  // Settings → Checkout, re-checked by placeOrder whatever the form showed.
  if (err instanceof CheckoutRuleViolation) return checkoutRuleMessage(err, pincode)
  return null
}

/** The shopper-facing reason a checkout rule refused the order. */
function checkoutRuleMessage(err: CheckoutRuleViolation, pincode: string): string {
  const e = checkoutContent.errors
  switch (err.rule) {
    case 'contact':
      return Object.values(err.fields)[0] ?? e.contact
    case 'minimum_order':
      return e.minimumOrder(formatMoney(err.amountPaise ?? 0))
    case 'cod_blocked_pincode':
      return e.codUnavailable
    case 'cod_over_limit':
      return e.codOverLimit(formatMoney(err.amountPaise ?? 0))
    case 'state_mismatch':
      return e.stateMismatch(pincode)
    case 'cod_high_risk':
      return e.codHighRisk
    case 'cod_prepaid_only_option':
      return deliveryOptionsContent.codPrepaidOnlyOption
    case 'cod_abroad':
      return e.codAbroad
  }
}
