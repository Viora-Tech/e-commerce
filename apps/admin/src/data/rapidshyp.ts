/** Copy for the RapidShyp app (Apps → RapidShyp). */
export const rapidshypAppContent = {
  connect: {
    title: 'Connect RapidShyp',
    intro: 'Follow the three steps below to link your RapidShyp account. It takes about a minute.',
    dashboardUrl: 'https://app.rapidshyp.com/',
    signupUrl: 'https://www.rapidshyp.com/',
    openDashboard: 'Open RapidShyp',
    noAccount: "Don't have a RapidShyp account?",
    signUp: 'Sign up',
    steps: {
      one: {
        title: 'Generate an API key',
        body: "In your RapidShyp dashboard, look under Settings for the API key generator and create one. If you don't see it on your plan, email techsupport@rapidshyp.com and ask them to enable API access for your account.",
      },
      two: {
        title: 'Copy the API key',
        body: 'RapidShyp may not show the full key again later, so save it somewhere safe (a password manager) the moment you generate it.',
      },
      three: {
        title: 'Paste it below and pick your pickup location',
        body: 'Fill in the fields, then use "Test connection" to make sure everything works before saving.',
      },
    },
    stepDone: 'Done',
    stepLabel: (n: number) => `Step ${n}`,
    fields: {
      apiKey: {
        label: 'API key',
        help: 'From your RapidShyp dashboard (Settings → API).',
      },
      storeName: {
        label: 'Store name',
        help: 'RapidShyp\'s channel identifier. Use "DEFAULT" unless RapidShyp set up a named sales channel for you.',
      },
      pickupAddressName: {
        label: 'Pickup location nickname',
        help: 'Must match a pickup location nickname registered in RapidShyp exactly, including spacing and capitalisation.',
      },
      originPincode: {
        label: 'Origin PIN code',
        help: 'The 6-digit PIN code your parcels ship from. We use this to test the connection and to compare courier rates.',
      },
    },
    testConnection: 'Test connection',
    testing: 'Testing…',
    testHint:
      "We check this with a real serviceability lookup using your API key - nothing is booked. This can't confirm the pickup location nickname; RapidShyp only checks that when you book a shipment.",
    advanced: {
      trigger: 'Advanced',
      baseUrlLabel: 'API base URL',
      baseUrlHelp: 'Leave blank for production.',
    },
    rateLimited: 'Too many attempts. Wait a few minutes and try again.',
  },
  overview: {
    title: 'RapidShyp',
    subtitle: 'Rate comparison, bookings and cancellation across RapidShyp’s courier network.',
    notConnected: 'Not connected yet. Add your account details to start booking shipments.',
    connectCta: 'Connect your account',
    connected: 'Connected',
    connectedAndTested: 'Connected ✓ tested',
    goToShipments: 'Open the Shipments workspace',
    goToShipmentsHelp: 'Book and manage every RapidShyp shipment from Orders → Shipments.',
    capabilitiesHeading: 'What this app can do',
    capabilities: {
      serviceability: 'Check if a PIN code is deliverable, with an estimated delivery date',
      rates: 'Compare prices and delivery times across RapidShyp’s courier network',
      create_shipment: 'Book a shipment with the best available courier and get an AWB',
    } as Record<string, string>,
    notYetSupported: 'Not yet available for RapidShyp',
    notYetSupportedItems: [
      'Automatic label printing',
      'Automatic tracking updates (webhook or polling)',
      'NDR reattempt / change address from the queue',
      'Wallet balance',
      'Cancel from this app (cancel from the RapidShyp dashboard for now)',
    ],
    copied: 'Copied',
  },
}
