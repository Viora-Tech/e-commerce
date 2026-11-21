/** Copy for the Snapmint app (Apps → Snapmint): cardless EMI, connected directly. */
export const snapmintAppContent = {
  connect: {
    title: 'Connect Snapmint',
    intro:
      'Let shoppers pay in monthly EMIs on UPI or a debit card, no credit card needed. Snapmint shows at checkout as its own way to pay, only to shoppers it can approve.',
    signupUrl: 'https://snapmint.com/',
    openSignup: 'Open Snapmint',
    steps: {
      one: {
        title: 'Get your Snapmint details',
        body: 'Snapmint gives you a Merchant ID, a Merchant key and a Merchant token when they set up your account. Sandbox details come first; live ones after Snapmint approves your business.',
        note: 'Your Snapmint account manager sends them. They are not on a sign-up page.',
      },
      two: {
        title: 'Send Snapmint two things',
        body: 'Snapmint only takes checkouts from addresses it knows, and sends payment updates to the address below. Email both to your Snapmint account manager before your first test.',
      },
      three: {
        title: 'Paste your details below',
        body: 'Pick Sandbox or Live to match them, fill in the three boxes, then press "Test connection".',
      },
    },
    mode: {
      label: 'Mode',
      test: 'Sandbox',
      live: 'Live',
      help: {
        test: "Using Snapmint's sandbox. No real money moves. Use your sandbox details here.",
        live: 'Using your live Snapmint account. Real EMIs from real shoppers.',
      },
    },
    fields: {
      merchantId: {
        label: 'Merchant ID',
        help: 'A number Snapmint gave you (the MID).',
      },
      merchantKey: {
        label: 'Merchant key',
        help: 'From Snapmint. Keep it private: we store it locked and never show it again.',
      },
      merchantToken: {
        label: 'Merchant token',
        help: 'From Snapmint too. Also kept locked; it is how your store talks to Snapmint.',
      },
    },
    testConnection: 'Test connection',
    testing: 'Testing…',
    testHint:
      'We ask Snapmint about an order that does not exist. Nothing is created and no money moves. This checks the Merchant token only.',
    rateLimited: 'Too many attempts. Wait a few minutes and try again.',
    saveLabel: 'Save and turn on',
    saved: 'Snapmint is on',
    saveFailed: 'Could not save',
    unsaved: 'Unsaved changes',
    discard: 'Discard',
    setup: {
      heading: 'What to send Snapmint',
      intro: 'Snapmint sets these up on their side. Until they do, checkouts and updates fail.',
      webhookLabel: 'Payment updates URL',
      webhookHelp:
        'Snapmint sends every payment result here. Your store must be on a public web address; localhost does not work.',
      ipLabel: 'Server IP address',
      ipHelp:
        'Snapmint only accepts checkouts from your store’s server IP addresses (one for testing, one for live). Ask us for them if you do not have them, then send them to Snapmint to add to their allow list.',
    },
  },
  overview: {
    title: 'Snapmint',
    subtitle: 'EMI on UPI and debit cards, no credit card needed.',
    notConnected: 'Not connected yet. Add your Snapmint details to offer EMI at checkout.',
    connectCta: 'Connect your account',
    connected: 'Connected',
    connectedAndTested: 'Connected ✓ tested',
    mode: { test: 'Sandbox', live: 'Live' },
    manage: 'Change details or settings',
    paymentsCta: 'Open Settings → Payments',
    capabilitiesHeading: 'What this app can do',
    capabilities: [
      'Show "Snapmint · EMI on UPI & cards, no credit card needed" at checkout',
      'Hide it from shoppers Snapmint would turn down, before they pick it',
      'Mark the order paid once Snapmint confirms the EMI',
      'Check Snapmint for the latest status when an update is late',
      'Refund all or part of an order from the order page',
    ],
    limitsHeading: 'Good to know',
    limits: [
      'Shoppers need a 10-digit Indian mobile number; orders in other currencies do not show Snapmint.',
      'Snapmint decides who gets EMI and on what plan; the shopper finishes on Snapmint’s page.',
      'Snapmint must add your server IP addresses and payment updates URL before it works.',
    ],
  },
}
