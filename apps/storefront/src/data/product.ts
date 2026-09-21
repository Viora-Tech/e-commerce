/** Copy and thresholds for the product page. Change here, never in a component. */
export const emiHintContent = {
  /** Below this the hint is noise; Razorpay lists no minimum for Snapmint, lenders start around ₹1,000. */
  minPricePaise: 100000,
  label: (monthly: string) => `EMI from ${monthly}/month`,
  detail: 'Cardless EMI with Snapmint or card EMI at checkout.',
} as const
