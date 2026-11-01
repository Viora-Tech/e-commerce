/**
 * Copy for Settings → Payments: several gateways at once ("Active providers", "Route methods")
 * and the "Manual payment methods" rows (UPI ID, bank transfer, cash on delivery). Audit #148,
 * #149, #150.
 */
export const paymentRoutingContent = {
  providers: {
    heading: 'Active providers',
    help: 'Payment companies switched on at checkout. If the first one cannot open a payment, checkout tries the next one that takes the same method.',
    main: 'Main',
    on: 'On at checkout',
    off: 'Off',
    turnOn: (name: string) => `Turn ${name} on at checkout`,
    noneOn: 'Every provider is off, so shoppers cannot pay online.',
    save: 'Save providers',
    saved: 'Providers saved.',
    saveFailed: 'Could not save. Try again.',
  },
  routes: {
    heading: 'Route methods',
    help: 'Pick which provider takes each way to pay. For example UPI on Cashfree and cards on Razorpay.',
    nobody: 'No active provider takes this',
    offInMethods: 'Off in "Shoppers can pay with"',
    save: 'Save routes',
    saved: 'Routes saved.',
    saveFailed: 'Could not save. Try again.',
  },
  manual: {
    heading: 'Manual payment methods',
    help: 'Shoppers pay you directly. The order waits as "Payment pending" until you mark it paid from the order page.',
    active: 'Active',
    off: 'Off',
    setUp: 'Set up',
    edit: 'Edit',
    turnOn: (name: string) => `Turn ${name} on`,
    upi: {
      title: 'UPI ID',
      help: 'The shopper pays your UPI ID or scans its QR code.',
    },
    bank: {
      title: 'Bank transfer / deposit',
      help: 'The shopper sends NEFT, IMPS or RTGS to your account. Your bank details show on the thank-you page and in the order email.',
    },
    cod: {
      title: 'Cash on delivery',
      help: 'The shopper pays the courier in cash.',
      settings: 'COD rules',
    },
    saved: 'Saved.',
    saveFailed: 'Could not save. Try again.',
  },
  dialog: {
    upiTitle: 'UPI ID',
    bankTitle: 'Bank transfer / deposit',
    description: 'What shoppers see when they pick this way to pay.',
    on: 'Show at checkout',
    upiId: 'UPI ID',
    upiIdHelp: 'For example waimers@hdfcbank',
    payeeName: 'Payee name',
    payeeNameHelp: 'The name the UPI app shows.',
    bankName: 'Bank',
    accountName: 'Account holder',
    accountNumber: 'Account number',
    ifsc: 'IFSC',
    ifscHelp: '11 characters, like HDFC0001234',
    note: 'Instructions for the shopper',
    noteHelp:
      'Shown with the payment details at checkout, on the thank-you page and in the order email.',
    notePlaceholder: 'Add your order number as the payment note. We ship once the money arrives.',
    adjustmentNote: 'The fee or discount applies to both UPI ID and bank transfer.',
    cancel: 'Cancel',
    save: 'Save',
  },
}
