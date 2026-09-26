/** Copy for the "Delivery checker" app block. Never inline this in the block. */
export const deliveryCheckerCopy = {
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
