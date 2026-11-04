/** Copy for the cart page and the discount code field shared with checkout. */
export const cartContent = {
  title: 'Your cart',
  heading: 'Cart',
  itemCount: (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`,
  remove: 'Remove',
  preorder: 'Pre-order',
  /** A pre-order campaign keeps its pre-orders apart from in-stock items (#143). */
  preorderMixedCart:
    'Pre-orders ship on their own. Check out your cart first, or remove the in-stock items, then add this.',
  continueShopping: 'Continue shopping',
  paymentMethods: 'Ways to pay',
  payments: ['UPI', 'Cards', 'Cash on delivery', 'EMI'],
  /**
   * A market abroad pays online: cards, and UPI when the parcel goes to an Indian address (the
   * checkout follows the address, owner 1 Nov). No cash on delivery or EMI there.
   */
  paymentsAbroad: ['Cards', 'UPI for Indian addresses'],
  summary: 'Order summary',
  upiPay: 'Pay',
  upiWith: 'with UPI',
  upiSave: 'Save',
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
  /** After "Buy again", the order's items that could not go in the cart (#162). */
  reorderSkipped: {
    heading:
      'Some items from your order could not be added, as they are sold out or no longer sold here:',
    more: (n: number) => (n === 1 ? 'and 1 more' : `and ${n} more`),
  },
  taxes: 'Inclusive of all taxes.',
  taxesAtCheckout: 'Taxes included. Shipping and COD fee calculated at checkout.',
  taxesAtCheckoutAbroad: 'Shipping calculated at checkout.',
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
    min_quantity: 'Add more items to use that code.',
    not_eligible: 'That code is not available for your account.',
    first_order_only: 'That code is for first orders only, and you have ordered with us before.',
  } as Record<string, string>,
  rejected: (code: string) => `${code} no longer applies and was removed.`,
} as const
