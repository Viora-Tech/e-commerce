/** Checkout's error messages (a refused order, a failed payment start); part of checkoutContent. */

export const checkoutErrorsContent = {
  unserviceable: (pincode: string) => `We cannot deliver to ${pincode} yet. Try another address.`,
  codUnavailable:
    'Cash on delivery is not available for this PIN code. Pick another payment method.',
  pickShipping: 'Pick a shipping option to pay.',
  codAbroad: 'Cash on delivery is only offered in India. Pick another payment method.',
  noShipping: (pincode: string) => `We do not ship to ${pincode} yet. Try another address.`,
  cannotShipToState: "We can't deliver this item to your state yet.",
  priceNotSet:
    'An item in your cart is not for sale yet, so your order was not placed. Remove it and try again.',
  variantHidden:
    'An item in your cart is no longer available, so your order was not placed. Remove it and try again.',
  notSoldInMarket:
    'An item in your cart is not sold in your country, so your order was not placed. Remove it and try again.',
  rateChanged:
    'The shipping options for your order changed, so it was not placed. Pick a shipping method and place it again.',
  discountUnavailable:
    'That discount has just run out, so your order was not placed. Check the new total and place it again.',
  discountNotApplied: (code: string) =>
    `We applied ${code} for you. Check the new total, then tap Pay again.`,
  discountRefused: (code: string, why: string) =>
    `${code} can't be used on this order: ${why} Your order was not placed. Remove the code to pay the full price, or try another code.`,
  rateLimited: 'Too many attempts. Please wait a minute and try again.',
  cartLimit: (title: string, max: number) =>
    `You can buy up to ${max} of ${title || 'this item'} in one order. Lower the quantity in your cart and try again.`,
  preorderMixedCart:
    'Pre-orders in your cart ship on their own. Check out the pre-order separately from your other items.',
  paymentMethodHidden:
    'That way to pay is not available for this order. Pick another payment method.',
  contact: 'Check your contact details and try again.',
  minimumOrder: (missing: string) =>
    `Your order is below this shop's minimum. Add ${missing} more and try again.`,
  codOverLimit: (limit: string) =>
    `Cash on delivery is available on orders up to ${limit}. Please pay online.`,
  codHighRisk:
    'Cash on delivery is not available for this order. Please pay online, it only takes a moment.',
  stateMismatch: (pincode: string) =>
    `The state you picked does not match PIN code ${pincode}. Check the state and the PIN code, then try again.`,
}
