/** Copy for the cart page and the discount code field shared with checkout. */
export const cartContent = {
  title: 'Your cart',
  summary: 'Summary',
  subtotal: 'Subtotal',
  shipping: 'Shipping',
  shippingFree: 'Free',
  total: 'Total',
  taxes: 'Inclusive of all taxes.',
  checkout: 'Check out',
  empty: {
    heading: 'Your cart is empty',
    body: 'Find something worth gliding on.',
    cta: 'Continue shopping',
  },
} as const

export const discountFieldContent = {
  label: 'Discount code',
  placeholder: 'Enter code',
  apply: 'Apply',
  remove: 'Remove',
  applied: (code: string) => `${code} applied`,
  automatic: 'Offer applied',
  errors: {
    invalid: 'That code is not valid.',
    not_applicable: 'That code does not apply to the items in your cart.',
    min_subtotal: 'Your order is below the minimum for that code.',
    limit_reached: 'That code has reached its usage limit.',
  } as Record<string, string>,
  rejected: (code: string) => `${code} no longer applies and was removed.`,
} as const
