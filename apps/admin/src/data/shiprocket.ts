/** Copy for the Shiprocket app (Apps → Shiprocket). */
export const shiprocketAppContent = {
  connect: {
    title: 'Connect Shiprocket',
    intro: 'Follow the three steps below to link your Shiprocket account. It takes about a minute.',
    dashboardUrl: 'https://app.shiprocket.in/login',
    signupUrl: 'https://app.shiprocket.in/sign-up',
    openDashboard: 'Open Shiprocket',
    noAccount: "Don't have a Shiprocket account?",
    signUp: 'Sign up',
    steps: {
      one: {
        title: 'Create an API user',
        body: 'In Shiprocket, go to Settings › API › Configure, and add a new API user. This is a separate login from the one you use to sign in - it only needs an email and password, and it is what we connect with, never your own dashboard password.',
      },
      two: {
        title: 'Note the API user email and password',
        body: 'Shiprocket does not show these again later, so save them somewhere safe (a password manager) the moment you create them.',
      },
      three: {
        title: 'Paste them below and pick your pickup location',
        body: 'Fill in the fields, then use "Test connection" to make sure everything works before saving.',
      },
    },
    stepDone: 'Done',
    stepLabel: (n: number) => `Step ${n}`,
    fields: {
      email: {
        label: 'API user email',
        help: 'The email of the API user you created in Settings › API - not your Shiprocket login email.',
      },
      password: {
        label: 'API user password',
        help: 'The password you set when creating the API user.',
      },
      pickupLocationName: {
        label: 'Pickup location nickname',
        help: 'Must match a pickup location nickname registered in Shiprocket exactly, including spacing and capitalisation.',
      },
      originPincode: {
        label: 'Origin PIN code',
        help: 'The 6-digit PIN code your parcels ship from. We use this to test the connection and to compare courier rates.',
      },
    },
    testConnection: 'Test connection',
    testing: 'Testing…',
    testHint:
      "We check this by logging in with your API user credentials - nothing is booked. This can't confirm the pickup location nickname; Shiprocket only checks that when you book a shipment.",
    advanced: {
      trigger: 'Advanced',
      baseUrlLabel: 'API base URL',
      baseUrlHelp: 'Leave blank for production.',
      webhookSecretLabel: 'Webhook shared secret',
      webhookSecretHelp:
        'Optional. Paste the same value into the custom header field when you register the tracking webhook in Shiprocket (Settings › API › Webhooks).',
      webhookUrlLabel: 'Tracking webhook URL',
      webhookNeedsDomain:
        'Webhooks only work once your store is live on a public domain - Shiprocket cannot reach localhost or a preview URL.',
    },
    rateLimited: 'Too many attempts. Wait a few minutes and try again.',
  },
  overview: {
    title: 'Shiprocket',
    subtitle:
      'Rate comparison, bookings, tracking, NDR and wallet balance across Shiprocket’s courier network.',
    notConnected: 'Not connected yet. Add your account details to start booking shipments.',
    connectCta: 'Connect your account',
    connected: 'Connected',
    connectedAndTested: 'Connected ✓ tested',
    goToShipments: 'Open the Shipments workspace',
    goToShipmentsHelp: 'Book, track and manage every Shiprocket shipment from Orders → Shipments.',
    capabilitiesHeading: 'What this app can do',
    capabilities: {
      serviceability: 'Check if a PIN code is deliverable, with an estimated delivery date',
      rates: 'Compare prices and delivery times across Shiprocket’s courier network',
      create_shipment: 'Book a shipment with the best available courier and get an AWB',
      label: 'Print the shipping label',
      tracking: 'Track scans automatically, a few times a day',
      webhook: 'Get near-instant tracking updates if you turn on the webhook',
      ndr: 'Reattempt delivery or change the address from the NDR queue',
      wallet: 'See your live Shiprocket wallet balance and get low-balance alerts',
    } as Record<string, string>,
    webhookUrlLabel: 'Tracking webhook URL',
    webhookUrlHelp:
      'Paste this into Shiprocket → Settings → API → Webhooks, along with the same shared secret you set on the connect page, so scans reach this app within minutes instead of waiting for the next poll.',
    copied: 'Copied',
  },
}
