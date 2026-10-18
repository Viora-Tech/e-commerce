/** Copy for the cart page and the discount code field shared with checkout. */
export const cartContent = {
  title: 'Your cart',
  itemCount: (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`,
  remove: 'Remove',
  preorder: 'Pre-order',
  continueShopping: 'Continue shopping',
  paymentMethods: 'Ways to pay',
  payments: ['UPI', 'Cards', 'Cash on delivery', 'EMI'],
  summary: 'Summary',
  subtotal: 'Subtotal',
  shipping: 'Shipping',
  shippingFree: 'Free',
  shippingAtCheckout: 'Calculated at checkout',
  freeShipping: {
    remaining: (amount: string) => `Add ${amount} more for free shipping`,
    unlocked: 'Your order ships free',
    label: 'Progress towards free shipping',
  },
  total: 'Total',
  taxes: 'Inclusive of all taxes.',
  taxesAtCheckout: 'Taxes included. Shipping and COD fee calculated at checkout.',
  checkout: 'Check out',
  drawer: {
    close: 'Close cart',
    viewCart: 'View cart',
    loading: 'Loading your cart…',
    failed: 'Could not load your cart. Open the cart page instead.',
    decrease: (title: string) => `One less ${title}`,
    increase: (title: string) => `One more ${title}`,
  },
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
