/** Copy for the login and sign-up screen. */
export const loginContent = {
  signIn: {
    title: 'Welcome back',
    body: 'Sign in with your email. We will send you a 6-digit code.',
    submit: 'Send code',
  },
  signUp: {
    title: 'Create your store',
    body: (brand: string) =>
      `Enter your email to start with ${brand}. We will send you a 6-digit code.`,
    submit: 'Send code',
    haveAccount: 'Already have a store?',
    signInLink: 'Sign in',
  },
  newHere: (brand: string) => `New to ${brand}?`,
  createStore: 'Create your store',
  email: 'Email',
  emailPlaceholder: 'you@yourstore.in',
  sending: 'Sending code',
  otp: {
    title: 'Check your email',
    sentTo: (email: string) => `We sent a 6-digit code to ${email}.`,
    label: 'Login code',
    submit: 'Log in',
    verifying: 'Checking code',
    resendIn: (time: string) => `Resend in ${time}`,
    resend: 'Send a new code',
    resent: 'A new code is on its way.',
    differentEmail: 'Use a different email',
    devHint: 'In development the code is printed in the admin server log.',
  },
  sendFailed: 'Could not send the code',
  wrongCode: 'Wrong code',
  passkey: {
    or: 'or',
    button: 'Sign in with a passkey',
    failed: 'Could not sign in with a passkey. Use a code by email instead.',
  },
  terms: {
    prefix: 'By continuing you agree to the',
    terms: 'Terms of Service',
    and: 'and',
    privacy: 'Privacy Policy',
  },
  panel: {
    label: 'What you can do',
    dot: (n: number) => `Show slide ${n}`,
    slides: [
      {
        title: 'Every order, the moment it lands',
        body: 'See new orders, sales and shipping at a glance.',
      },
      {
        title: 'Ask your store anything',
        body: 'Get answers about sales and stock in plain words.',
      },
      {
        title: 'GST invoices and WhatsApp updates, automatic',
        body: 'Every order gets its invoice and a customer update.',
      },
      { title: 'Ship with one tap', body: 'Pick a courier, print the label, done.' },
    ],
    order: { title: 'New order #1043', meta: '₹4,499 · Pune', paid: 'Paid' },
    sales: { label: "Today's sales", value: '₹84,200', change: '12%' },
    shipped: { title: 'Shipped via Delhivery', meta: 'AWB 3891 2045 7731' },
    ai: {
      question: 'Which product sold most this week?',
      answer: 'Cotton kurta set, 42 sold. Up 18% on last week.',
      bars: ['Cotton kurta', 'Linen shirt', 'Silk dupatta'],
    },
    invoice: { title: 'Invoice INV-1043', gst: 'GST 5%', total: '₹4,499', status: 'Sent' },
    whatsapp: 'Hi Asha, your order #1043 is confirmed. We will ship it tomorrow.',
    couriers: [
      { name: 'Delhivery', eta: 'Delivers in 2 days', price: '₹62' },
      { name: 'Shiprocket', eta: 'Delivers in 3 days', price: '₹54' },
    ],
    labelPrinted: 'Label printed',
    built: 'Built for Indian brands',
    chips: ['UPI', 'GST invoices', 'WhatsApp updates'],
  },
} as const
