/** The checkout's step copy: the stepper, the finished rows and each step's heading. */
export const checkoutStepsContent = {
  /** The finished steps above the current one. */
  review: {
    contact: 'Contact',
    shipTo: 'Ship to',
    delivery: 'Delivery',
    cart: 'Cart',
    change: 'Change',
    changeLabel: (label: string) => `Change ${label.toLowerCase()}`,
  },
  /** The heading and line each step opens with. */
  stepIntro: {
    signIn: {
      title: 'Sign in or create your account',
      phone: 'Use your phone number. We will send you a code. No password needed.',
      email: 'Use your email. We will send you a code. No password needed.',
      both: 'Use your phone number or email. We will send you a code. No password needed.',
    },
    contact: { title: 'Your contact details', body: 'We send your order updates here.' },
    address: { title: 'Where should we deliver?', body: 'Choose an address or add a new one.' },
    shipping: {
      title: 'How would you like it delivered?',
      body: 'Pick what suits you.',
      datesFor: (place: string) => `Dates shown are for ${place}.`,
    },
    payment: {
      title: 'How would you like to pay?',
      body: 'All payments are encrypted. Pick the way that is easiest for you.',
    },
  },
  /** Under the summary card. */
  trustBlock: {
    secure: { title: 'Secure payment', body: '256-bit encrypted. We never see your card details.' },
    returns: { title: 'Easy returns', body: 'Read our refund policy' },
    processedBy: 'Payments processed by',
  },
  totalCurrency: 'INR',
  stepsLabel: 'Checkout steps',
  stepsBackTo: (label: string) => `Back to ${label.toLowerCase()}`,
  backTo: (label: string) => `Back to ${label}`,
  continueLabel: 'Continue',
  continueTo: (label: string) => `Continue to ${label.toLowerCase()}`,
  completeSteps: 'Complete all steps to pay',
  backToCartCount: (count: number) => `Back to cart · ${count} ${count === 1 ? 'item' : 'items'}`,
}
