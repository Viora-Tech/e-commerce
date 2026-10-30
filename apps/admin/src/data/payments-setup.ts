/**
 * Copy for the easy payments setup: Settings → Payments, the first-time guide
 * and the Razorpay / Cashfree Connect pages. Plain words for a shop owner who
 * has never set up a payment gateway.
 */

import type { SortableListLabels } from '@commerce/ui/sortable'

export type MethodId = 'upi' | 'card' | 'netbanking' | 'wallet' | 'emi' | 'cod'

export const methodNames: Record<MethodId, { name: string; help: string }> = {
  upi: { name: 'UPI', help: 'GPay, PhonePe, Paytm and any UPI app' },
  card: { name: 'Cards', help: 'Debit and credit cards' },
  netbanking: { name: 'Netbanking', help: 'Pay straight from a bank account' },
  wallet: { name: 'Wallets', help: 'Paytm, Amazon Pay and other wallets' },
  emi: { name: 'Pay later / EMI', help: 'Pay in parts or pay next month' },
  cod: { name: 'Cash on delivery', help: 'Shopper pays the courier in cash' },
}

export type GatewayCatalogueEntry = {
  id: string
  name: string
  /** Two letters in the logo tile; we do not ship other companies' logos. */
  monogram: string
  blurb: string
  methods: MethodId[]
  fees: string
  /** False: listed so merchants know it is coming. True still needs the app in this deployment. */
  available: boolean
}

/** Everything "+ Add another way to get paid" lists. Only apps this deployment ships can connect. */
export const gatewayCatalogue: GatewayCatalogueEntry[] = [
  {
    id: 'razorpay',
    name: 'Razorpay',
    monogram: 'Rz',
    blurb: 'The most used payment company in India. Quick to sign up.',
    methods: ['upi', 'card', 'netbanking', 'wallet', 'emi'],
    fees: 'Around 2% per payment. Razorpay sets your exact rate.',
    available: true,
  },
  {
    id: 'cashfree',
    name: 'Cashfree',
    monogram: 'Cf',
    blurb: 'Popular with small shops. Payment updates are set up for you.',
    methods: ['upi', 'card', 'netbanking', 'wallet', 'emi'],
    fees: 'Around 2% per payment. Cashfree sets your exact rate.',
    available: true,
  },
  {
    id: 'decentro',
    name: 'UPI — confirmed automatically (Decentro)',
    monogram: 'De',
    blurb: "Shoppers scan a QR made for their order; it's marked paid by itself within seconds.",
    methods: ['upi'],
    fees: 'Set by Decentro.',
    /** Connects once the Decentro app ships in commerce.config.ts; "Coming soon" until then. */
    available: true,
  },
  {
    id: 'phonepe',
    name: 'PhonePe',
    monogram: 'Pe',
    blurb: 'Take payments through the PhonePe payment gateway.',
    methods: ['upi', 'card', 'netbanking'],
    fees: 'Set by PhonePe.',
    available: false,
  },
  {
    id: 'payu',
    name: 'PayU',
    monogram: 'Pu',
    blurb: 'Cards, UPI, netbanking and EMI.',
    methods: ['upi', 'card', 'netbanking', 'wallet', 'emi'],
    fees: 'Set by PayU.',
    available: false,
  },
]

export const paymentsSetupContent = {
  title: 'Payments',
  intro: 'Get paid online, and choose how shoppers can pay.',
  status: {
    ready: 'You can take payments',
    readyOffline: 'You can take cash on delivery only',
    notReady: "You can't take payments yet",
    notReadyHelp: 'Connect a way to get paid, or turn on cash on delivery.',
    offlineHelp: 'Connect a way to get paid to take UPI and cards too.',
  },
  testOrder: 'Place a test order',
  openGuide: 'Set up step by step',
  backToPayments: 'Payments',
  testOrderHelp:
    'Opens your checkout in a new tab with a ₹1 test item. Nothing real is charged in Test mode.',
  testOrderFailed: 'Could not open a test order. Try again.',
  main: {
    heading: 'Main way to get paid',
    empty: 'Nothing connected yet',
    emptyHelp: 'Connect Razorpay or Cashfree to take UPI, cards and more.',
    connect: 'Connect',
    live: 'Live',
    test: 'Test',
    testHelp: 'Test mode: payments are pretend. Switch to Live keys when you are ready to sell.',
    working: 'Working',
    notWorking: 'Needs attention',
    lastPayment: 'Last payment',
    noPaymentsYet: 'No payments yet',
    viaOauth: 'Connected with one click',
    viaKeys: 'Connected with API keys',
    manage: 'Manage',
    change: 'Change',
  },
  problems: {
    webhook_silent:
      "Payments go through, but updates from the payment company aren't reaching your shop.",
    reconnect: 'Your connection ran out. Connect again to keep taking payments.',
    config_invalid: 'Some connection details are missing or wrong.',
    no_online_methods: 'Every online way to pay is turned off, so shoppers can only pay cash.',
    fix: 'Fix it',
    fixing: 'Fixing…',
    showHow: 'Show me how',
    reconnectAction: 'Connect again',
    openConnect: 'Check details',
    turnOnUpi: 'Turn on UPI',
    fixed: 'Fixed',
  },
  methods: {
    heading: 'Shoppers can pay with',
    help: 'Turn ways to pay on or off. Drag to change the order shoppers see.',
    needsGateway: 'Connect a way to get paid first',
    saved: 'Saved. Checkout is updated.',
    saveFailed: 'Could not save. Try again.',
  },
  add: {
    button: 'Add another way to get paid',
    title: 'Add a way to get paid',
    description: 'Pick a payment company. You can switch any time; your old details are kept.',
    search: 'Search payment companies',
    all: 'All',
    noResults: 'Nothing matches. Try another word.',
    connect: 'Connect',
    connected: 'Connected',
    comingSoon: 'Coming soon',
    fees: 'Fees',
    installing: 'Opening…',
    installFailed: 'Could not add this app. Ask the store owner to add it from Apps.',
  },
  upiOptions: {
    heading: 'Two more ways to take UPI',
    auto: {
      name: 'UPI — confirmed automatically',
      help: "Shoppers scan a QR made for their order; it's marked paid by itself within seconds.",
    },
    manual: {
      name: 'UPI to your own ID — you confirm it',
      help: 'Money comes straight to you, but you check your bank and mark each order paid.',
    },
    compare: {
      trigger: "What's this?",
      title: 'Which UPI should I use?',
      rows: [
        {
          label: 'Order marked paid',
          auto: 'By itself, in seconds',
          manual: 'You click Mark paid',
        },
        {
          label: 'Fake payment risk',
          auto: 'None: the payment company confirms it',
          manual: 'A shopper can show a fake screenshot. Always check your bank.',
        },
        { label: 'Fee', auto: "The payment company's fee", manual: 'No fee' },
        {
          label: 'Money arrives',
          auto: 'When the payment company pays you out',
          manual: 'Straight away, in your bank',
        },
      ],
      autoHeading: 'Confirmed automatically',
      manualHeading: 'Your own ID',
    },
    offNote: 'Both are off. Turn them on with Open, below.',
  },
  advanced: {
    heading: 'Advanced',
    help: 'Extra settings most shops never need.',
    manual: 'Bank transfer, UPI QR and fees per method',
    manualHelp: 'Turn on the two UPI options above, add a fee or discount, cancel unpaid orders.',
    open: 'Open',
    captureNote:
      'Payments are taken right away when the shopper pays. There is nothing to set up for this.',
  },
  whatsThis: {
    trigger: "What's this?",
    title: 'How getting paid online works',
    body: 'A payment company (like Razorpay or Cashfree) takes the money from the shopper by UPI or card and sends it to your bank account. They keep a small fee, usually around 2%.',
  },
  guide: {
    label: 'View setup guide',
  },
  wizard: {
    progress: (step: number, total: number) => `Step ${step} of ${total}`,
    skip: 'Skip for now',
    back: 'Back',
    next: 'Next',
    how: {
      title: 'How do you want to get paid?',
      body: 'Pick a payment company. They take UPI and card payments and send the money to your bank.',
      codOnly: 'Only cash on delivery for now',
      codOnlyHelp: 'You can connect online payments later.',
      recommended: 'Most popular',
    },
    connect: {
      title: (name: string) => `Connect ${name}`,
      body: 'This links your account so money from your shop goes to you.',
    },
    methods: {
      title: 'Which payments do you want to take?',
      body: 'We turned on the most common ones. You can change this any time.',
    },
    test: {
      title: 'Try a ₹1 test order',
      body: 'Open your checkout, pay ₹1, and see the order arrive. In Test mode no real money moves.',
      open: 'Open test checkout',
      opened: 'Opened in a new tab. Come back here when you are done.',
    },
    ready: {
      title: "You're ready",
      body: 'Shoppers can now pay you online. Your payment company sends the money to your bank.',
      codBody: 'Shoppers can now pay cash on delivery. Connect online payments any time from here.',
      done: 'Go to Payments',
    },
    skipped: 'Setup skipped. You can finish it here any time.',
  },
  connect: {
    mode: {
      label: 'Which keys?',
      test: 'Test',
      live: 'Live',
      testHelp: 'Test keys: nothing real is charged. Good for trying things out.',
      liveHelp: 'Live keys: real money from real shoppers.',
    },
    oneClick: (name: string) => `Connect ${name}`,
    oneClickHelp: 'You will log in to Razorpay and press Allow. That is all.',
    orKeys: 'Or paste API keys instead',
    testConnection: 'Test connection',
    testing: 'Checking…',
    testHint: 'Checks your details with the payment company. Nothing is charged or created.',
    save: 'Save and connect',
    saving: 'Connecting…',
    saved: (name: string) => `${name} is connected`,
    saveFailed: 'Could not connect. Check the details and try again.',
    copy: 'Copy',
    newSecret: 'Make a new secret',
    savedSecret:
      'Already saved. Make a new one only if you lost it, then paste the new one into Razorpay too.',
    copied: 'Copied',
    signUp: "Don't have an account yet?",
    signUpLink: 'Sign up free',
    openDashboard: 'Open dashboard',
    modeMismatch: {
      test: 'These look like Live keys, but Test is picked. Pick Live, or paste Test keys.',
      live: 'These look like Test keys, but Live is picked. Pick Test, or paste Live keys.',
    },
    oauthResult: {
      razorpay: 'Razorpay is connected.',
      'razorpay-webhook':
        'Razorpay is connected. Payment updates will switch on once your shop is online.',
      failed: 'Razorpay did not connect. Try again.',
      cancelled: 'Connecting Razorpay was cancelled.',
    } as Record<string, string>,
  },
} as const

type GuideStep = { title: string; body: string }

export type GatewayGuide = {
  name: string
  intro: string
  dashboardUrl: string
  signupUrl: string
  steps: [GuideStep, GuideStep, GuideStep]
  fields: Record<string, { label: string; help: string; placeholder?: string }>
}

export const gatewayGuides: Record<'razorpay' | 'cashfree', GatewayGuide> = {
  razorpay: {
    name: 'Razorpay',
    intro: 'Take UPI, cards, netbanking, wallets and EMI through Razorpay.',
    dashboardUrl: 'https://dashboard.razorpay.com/app/website-app-settings/api-keys',
    signupUrl: 'https://dashboard.razorpay.com/signup',
    steps: [
      {
        title: 'Open your Razorpay dashboard',
        body: 'Log in, then go to Account & Settings → API Keys. Pick Test or Live at the top of the dashboard.',
      },
      {
        title: 'Create a key and paste it here',
        body: 'Press Generate Key. Copy the Key ID and the Key Secret into the boxes below. The secret is shown only once.',
      },
      {
        title: 'Turn on payment updates',
        body: 'In Account & Settings → Webhooks, press Add New Webhook. Paste the address and secret below, tick every event listed under them, and save.',
      },
    ],
    fields: {
      keyId: {
        label: 'Key ID',
        help: 'Starts with rzp_test_ or rzp_live_.',
        placeholder: 'rzp_test_…',
      },
      keySecret: { label: 'Key Secret', help: 'Shown once when you generate the key.' },
      webhookUrl: { label: 'Webhook address', help: 'Paste this into Razorpay.' },
      webhookSecret: {
        label: 'Webhook secret',
        help: 'We made one for you. Paste the same secret into Razorpay.',
      },
      webhookEvents: {
        label: 'Events to tick',
        help: 'Tick all of these under Active Events in Razorpay. Missing one means some payments or refunds never update here.',
      },
    },
  },
  cashfree: {
    name: 'Cashfree',
    intro: 'Take UPI, cards, netbanking, wallets and pay later through Cashfree.',
    dashboardUrl: 'https://merchant.cashfree.com/merchants/login',
    signupUrl: 'https://merchant.cashfree.com/merchants/signup',
    steps: [
      {
        title: 'Open your Cashfree dashboard',
        body: 'Log in to Payment Gateway, then go to Developers → API Keys. Pick Test or Live at the top.',
      },
      {
        title: 'Copy your keys here',
        body: 'Copy the App ID and the Secret Key into the boxes below.',
      },
      {
        title: 'Payment updates: nothing to do',
        body: 'We tell Cashfree where to send updates with every order, so there is no webhook to set up.',
      },
    ],
    fields: {
      appId: { label: 'App ID', help: 'Called "App ID" or "Client ID" in Cashfree.' },
      secretKey: {
        label: 'Secret Key',
        help: 'Called "Secret Key" or "Client Secret" in Cashfree.',
      },
    },
  },
}

export const methodSortLabels: SortableListLabels = {
  instructions:
    'Press space to pick up a way to pay, arrow keys to move it, space again to drop it.',
  handle: (title) => `Move ${title}`,
  picked: (title) => `Picked up ${title}`,
  moved: (title, position, total) => `${title} moved to position ${position} of ${total}`,
  dropped: (title, position, total) => `${title} dropped at position ${position} of ${total}`,
  cancelled: (title) => `Move of ${title} cancelled`,
}

/** `view=page` opens the full Payments page even for a shop that hasn't finished the guide. */
export const PAYMENTS_PAGE_HREF = '/settings/payments?view=page'
