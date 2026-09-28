/** Copy and thresholds for the product page. Change here, never in a component. */
export const emiHintContent = {
  /** Below this the hint is noise; Razorpay lists no minimum for Snapmint, lenders start around ₹1,000. */
  minPricePaise: 100000,
  label: (monthly: string) => `EMI from ${monthly}/month`,
  detail: 'Card EMI, cardless EMI or pay later at checkout.',
} as const

/** Copy for the product-page delivery estimate widget. */
export const deliveryEstimateContent = {
  heading: 'Check delivery',
  placeholder: 'Enter PIN code',
  button: 'Check',
  checking: 'Checking…',
  change: 'Change',
  deliversBy: (range: string) => `Delivery by ${range}`,
  dispatchToday: 'Order now, dispatches today.',
  dispatchOn: (date: string) => `Dispatches ${date}.`,
  cod: 'Cash on delivery available.',
  prepaidOnly: 'Prepaid only for this PIN code.',
  fallback: 'Estimate based on typical transit times.',
  unserviceable: (pincode: string) => `Sorry, we cannot deliver to ${pincode} yet.`,
} as const
