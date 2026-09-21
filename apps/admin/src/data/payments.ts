/** Copy for Settings → Payments. */
export const paymentsSettingsContent = {
  title: 'Payments',
  intro:
    'Enable the methods shoppers can pay with and add a fee or discount per method. Gateway keys are stored encrypted.',
  webhookHint: 'Webhook URL for the Razorpay dashboard:',
  adjustment: {
    heading: 'Fee or discount',
    typeLabel: 'Type',
    types: [
      { label: 'None', value: 'none' },
      { label: 'Fixed amount (₹)', value: 'fixed' },
      { label: 'Percent of subtotal', value: 'percent' },
    ],
    amountLabel: { fixed: 'Amount in ₹', percent: 'Percent' },
    amountHelp: 'Use a negative number for a discount, e.g. -2 for 2% off.',
    labelLabel: 'Label shown to shoppers',
    labelPlaceholder: { fixed: 'COD handling', percent: 'UPI discount' },
  },
} as const
