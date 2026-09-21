/** Copy for Settings → Payments. */
export const paymentsSettingsContent = {
  title: 'Payments',
  back: 'Settings',
  save: 'Save',
  saved: 'Payment settings saved',
  saveFailed: 'Save failed',
  couldNotSave: 'Could not save',
  enabled: 'Enabled',
  active: 'Active',
  off: 'Off',
  noConfig: 'No configuration needed.',
  secretHelp: 'Stored encrypted. Leave the masked value to keep it.',
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
