/** Copy for the Ekart app (Apps → Ekart); Hindi in `data/hi/ekart.ts`. */
export const ekartAppContent = {
  connect: {
    title: 'Connect Ekart',
    intro: 'Follow the three steps below to link your Ekart account. It takes about two minutes.',
    dashboardUrl: 'https://app.elite.ekartlogistics.in/',
    signupUrl: 'https://ekartlogistics.com/',
    openDashboard: 'Open Ekart',
    noAccount: "Don't have an Ekart account?",
    signUp: 'Sign up',
    steps: {
      one: {
        title: 'Find your API credentials',
        body: 'Ekart emails a client ID, API username and password when your account is onboarded. If you do not have them, ask your Ekart account manager for API access.',
      },
      two: {
        title: 'Note your pickup address alias',
        body: 'In the Ekart dashboard, open Addresses and copy the alias of the address your parcels leave from. With only one address registered you can skip this.',
      },
      three: {
        title: 'Paste them below',
        body: 'Fill in the fields, then use "Test connection" to make sure everything works before saving.',
      },
    },
    stepDone: 'Done',
    stepLabel: (n: number) => `Step ${n}`,
    fields: {
      clientId: {
        label: 'Client ID',
        help: 'From your Ekart onboarding email.',
      },
      username: {
        label: 'API username',
        help: 'From your Ekart onboarding email; not your dashboard login.',
      },
      password: {
        label: 'API password',
        help: 'Stored encrypted and never shown again.',
      },
      originPincode: {
        label: 'Origin PIN code',
        help: 'The 6-digit PIN code your parcels ship from. We use this to test the connection and to compare rates.',
      },
      pickupAlias: {
        label: 'Pickup address alias',
        help: 'The alias of your registered pickup address. Leave blank if you registered only one.',
      },
      sellerName: {
        label: 'Seller name',
        help: 'Your business name, printed on the label.',
      },
      sellerAddress: {
        label: 'Seller billing address',
        help: 'Your registered billing address, printed on the label.',
      },
      sellerGstin: {
        label: 'Seller GSTIN',
        help: '15 characters. Leave blank if you are not GST registered.',
      },
    },
    testConnection: 'Test connection',
    testing: 'Testing…',
    testHint:
      'We check this by signing in and looking up your own PIN code. Nothing is booked. The pickup alias is only checked when you book a shipment.',
    advanced: {
      trigger: 'Advanced',
      baseUrlLabel: 'API base URL',
      baseUrlHelp: 'Leave blank for production.',
      webhookSecretLabel: 'Webhook secret',
      webhookSecretHelp:
        'Required for automatic tracking updates: 6 to 30 characters. Use the same secret when Ekart registers your track_updated webhook; a push not signed with it is refused.',
      webhookUrlLabel: 'Tracking webhook URL',
      webhookNeedsDomain:
        'Webhooks only work once your store is live on a public domain; the courier cannot reach localhost or a preview URL.',
    },
    rateLimited: 'Too many attempts. Wait a few minutes and try again.',
  },
  overview: {
    title: 'Ekart',
    subtitle:
      'Rates and delivery days, bookings, return pickups, tracking and NDR on Ekart’s network.',
    notConnected: 'Not connected yet. Add your account details to start booking shipments.',
    connectCta: 'Connect your account',
    connected: 'Connected',
    connectedAndTested: 'Connected ✓ tested',
    goToShipments: 'Open the Shipments workspace',
    goToShipmentsHelp: 'Book, track and manage every Ekart shipment from Orders → Shipments.',
    capabilitiesHeading: 'What this app can do',
    capabilities: {
      serviceability: 'Check if a PIN code is deliverable, with COD and delivery days',
      rates: 'See Ekart’s price and delivery days for a parcel',
      create_shipment: 'Book a shipment and get an Ekart tracking id',
      tracking: 'Track scans automatically, a few times a day',
      webhook: 'Get near-instant tracking updates if you turn on the webhook',
      cancel: 'Cancel a booked shipment',
      ndr: 'Reattempt delivery (with a new phone or address) or send it back from the NDR queue',
      reverse_pickup: 'Book a courier pickup for a customer return',
    } as Record<string, string>,
    notYetSupported: 'Not yet available for Ekart',
    notYetSupportedItems: [
      'Printing the label from here (Ekart sends the label as a file; print it from the Ekart dashboard for now)',
      'Picking a courier service at booking (Ekart routes each parcel itself)',
      'Wallet balance',
    ],
    webhookUrlLabel: 'Tracking webhook URL',
    webhookWhere: 'Send to your Ekart account manager, or register it with Ekart’s webhook API',
    webhookUrlHelp:
      'Ekart registers webhooks for you. Give them this address with the same secret you set on the Connect page and ask for the track_updated topic, so scans reach this app within minutes.',
    copied: 'Copied',
  },
}
