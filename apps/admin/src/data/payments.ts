/** Copy for Settings → Payments. */
export const paymentsSettingsContent = {
  title: 'Payments',
  intro:
    'Enable the methods shoppers can pay with and add a fee or discount per method. Gateway keys are stored encrypted.',
  webhookHint: 'Webhook URL for the Razorpay dashboard:',
  unpaid: {
    heading: 'Unpaid orders',
    label: 'Cancel unpaid online orders after (minutes)',
    help: 'Orders paid online that are still unpaid after this long are cancelled and their stock is released. The gateway is checked first, so a late payment is kept. Cash on delivery and bank transfer orders are never cancelled. 0 turns this off.',
  },
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
