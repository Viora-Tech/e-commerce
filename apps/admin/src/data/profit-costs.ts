/** Copy for Settings › Costs for profit. Plain words: the rates a merchant pays on money taken. */
export const profitCostsContent = {
  title: 'Costs for profit',
  intro:
    'Order profit takes off what each payment method and cash on delivery cost you. When a gateway reports its fee on a payment, that fee is used instead.',
  gateways: {
    heading: 'Payment gateway fees',
    help: 'What the gateway keeps from each payment: a percentage, plus a fixed amount if it charges one.',
    none: 'No online payment method is on yet. Turn one on in Settings › Payments.',
  },
  cod: {
    heading: 'Cash on delivery',
    help: 'What your courier keeps for collecting cash from the customer.',
    label: 'Cash on delivery',
  },
  percent: 'Percent (%)',
  fixed: 'Fixed (₹)',
  methodNames: {
    razorpay: 'Razorpay',
    cashfree: 'Cashfree',
    payu: 'PayU',
    phonepe: 'PhonePe',
    stripe: 'Stripe',
    decentro: 'Decentro',
  } as Record<string, string>,
  save: 'Save',
  saved: 'Saved',
  failed: 'Could not save',
  invalid: (method: string) =>
    `Check the numbers for ${method}: a percent up to 100 and a rupee amount.`,
}
