/** Copy for Settings › Costs for profit. Plain words: the rates a merchant pays on money taken. */
export const profitCostsContent = {
  title: 'Costs for profit',
  intro:
    'Order profit takes off what each payment cost you. Actual fees come from Razorpay or Cashfree for each payment; these rates are only used until the fee arrives.',
  methods: {
    heading: 'Fees by how the customer paid',
    help: 'Filled in with Razorpay’s standard rates. These are standard rates: check your plan, yours may be lower. Type each rate before GST.',
    reset: 'Use standard rates',
    names: {
      upi: 'UPI',
      rupay_debit: 'RuPay debit cards',
      debit_card: 'Other debit cards',
      credit_card: 'Credit cards',
      international_card: 'International cards',
      corporate_card: 'Corporate, Amex and Diners cards',
      netbanking: 'Net banking',
      wallet: 'Wallets',
      emi: 'EMI',
      pay_later: 'Pay later',
    } as Record<string, string>,
  },
  gst: {
    claimable:
      'You have a GST registration, so you claim back the GST on these fees and profit leaves it out.',
    notClaimable: 'Profit adds 18% GST to each rate, as gateways and couriers charge it.',
  },
  gateways: {
    heading: 'Fees by gateway',
    help: 'Used when the gateway does not say how the customer paid, and for gateways like Decentro. Type each rate before GST.',
    none: 'No online payment method is on yet. Turn one on in Settings › Payments.',
  },
  cod: {
    heading: 'Cash on delivery',
    help: 'What your courier keeps for collecting cash from the customer, before GST.',
    label: 'Cash on delivery',
  },
  delivery: {
    heading: 'Delivery estimate',
    help: 'Until the courier’s charge for a parcel is known, profit counts your highest charge to the same state in the last 60 days. With none on record, it counts this amount per parcel.',
    label: 'Default delivery cost per parcel (₹)',
    gstClaimable: 'Type it before GST: you claim the GST back.',
    gstNotClaimable: 'Type what you actually pay, GST included.',
    invalid: 'Type the default delivery cost in rupees, like 100.',
  },
  percent: 'Percent (%)',
  fixed: 'Fixed (₹)',
  methodNames: {
    razorpay: 'Razorpay',
    razorpay_upi: 'Razorpay UPI QR',
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
