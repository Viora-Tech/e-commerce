/** Checkout's Express buttons and UPI apps copy; part of checkoutContent. */

export const checkoutExpressContent = {
  heading: 'Express checkout',
  /** The three app buttons; each pays by UPI and opens that app (or its QR) next. */
  apps: { gpay: 'Google Pay', phonepe: 'PhonePe', paytm: 'Paytm' },
  payWith: (app: string) => `Pay with ${app}`,
  /** Under the buttons: what one tap pays, shipping included. */
  total: (amount: string, shipping: string) => `Pays ${amount} by UPI, with ${shipping}.`,
  totalOnly: (amount: string) => `Pays ${amount} by UPI.`,
  shippingLine: (name: string, price: string) => `${name} shipping (${price})`,
  freeShipping: 'free shipping',
  noShippingYet: 'Add your PIN code below to see shipping, then pay in one tap.',
  needDetails: 'Add your contact and delivery details below, then tap again.',
  needShipping: 'Pick a shipping option below, then tap again.',
}
