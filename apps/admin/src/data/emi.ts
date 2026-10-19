/** Copy for the EMI & pay later app's admin page. Plain words: merchants are not technical. */
export const emiContent = {
  title: 'EMI & pay later',
  subtitle: 'Show shoppers they can pay in parts, right under the product price.',
  save: 'Save',
  discard: 'Discard',
  unsaved: 'Unsaved changes',
  saved: 'Saved',
  failed: 'Could not save. Try again.',
  status: {
    ready: 'Live. Shoppers see this on product pages.',
    off: 'Turned off. Shoppers do not see EMI offers.',
    gatewayNotSetUp: (gateway: string) =>
      `Set up ${gateway} first. Offers show once ${gateway} is taking payments.`,
    gatewaySetUpLink: (gateway: string) => `Set up ${gateway}`,
    emiOff: 'Turn on EMI at checkout first, so shoppers can actually pay in parts.',
    emiOffLink: 'Open payment settings',
  },
  show: {
    title: 'Product pages',
    label: 'Show EMI offers',
    help: 'Adds “or ₹X/month” under the price.',
  },
  gateway: {
    title: 'Who gives the EMI',
    help: 'Pick the payment company your checkout uses for EMI and pay later.',
    options: {
      razorpay: {
        label: 'Razorpay',
        help: 'Shows Razorpay’s own offers box with your banks, plans and offers.',
      },
      cashfree: {
        label: 'Cashfree',
        help: 'Shows a simple monthly price.',
      },
    },
    officialWidget: 'Using Razorpay’s offers box with your Razorpay key.',
    simpleLine: 'Showing a simple monthly price.',
  },
  minPrice: {
    title: 'Lowest price',
    label: 'Only show on products from (₹)',
    help: 'Cheaper products show nothing. Most lenders start at ₹1,000.',
  },
  preview: {
    title: 'Preview',
    example: (price: string) => `On a ${price} product:`,
    line: (monthly: string) => `or ${monthly}/month with EMI or pay later`,
    note: 'Simple estimate over 12 months. The final plan is set by the bank or lender at checkout.',
  },
} as const
