/** Copy for the Shadowfax app (Apps → Shadowfax); Hindi in `data/hi/shadowfax.ts`. */
export const shadowfaxAppContent = {
  connect: {
    title: 'Connect Shadowfax',
    intro: 'Follow the three steps below to link your Shadowfax account. It takes about a minute.',
    dashboardUrl: 'https://www.shadowfax.in/',
    signupUrl: 'https://www.shadowfax.in/',
    openDashboard: 'Open Shadowfax',
    noAccount: "Don't have a Shadowfax account?",
    signUp: 'Sign up',
    steps: {
      one: {
        title: 'Find your API key',
        body: 'Shadowfax emails your API key when your account is activated. Staging and production keys are different; use the production one here.',
      },
      two: {
        title: 'Keep it safe',
        body: 'The key is all it takes to book on your account, so store it in a password manager and never share it in chat.',
      },
      three: {
        title: 'Paste it below',
        body: 'Fill in the fields, then use "Test connection" to make sure everything works before saving.',
      },
    },
    stepDone: 'Done',
    stepLabel: (n: number) => `Step ${n}`,
    fields: {
      apiToken: {
        label: 'API key',
        help: 'From the email Shadowfax sends when your account is activated.',
      },
      originPincode: {
        label: 'Origin PIN code',
        help: 'The 6-digit PIN code your parcels ship from. Shadowfax collects from the address on each order’s ship-from location.',
      },
      sellerGstin: {
        label: 'Seller GSTIN',
        help: 'Used on return pickups. Leave blank if you are not GST registered.',
      },
    },
    testConnection: 'Test connection',
    testing: 'Testing…',
    testHint: 'We check this with a serviceability lookup on your own PIN code. Nothing is booked.',
    advanced: {
      trigger: 'Advanced',
      baseUrlLabel: 'API base URL',
      baseUrlHelp:
        'Leave blank for production. For a staging key use https://dale.staging.shadowfax.in/api',
      webhookSecretLabel: 'Webhook key',
      webhookSecretHelp:
        'Required for automatic tracking updates. Use the same value as the Authorization key on the Shadowfax client portal Webhook tab; a push without it is refused.',
      webhookUrlLabel: 'Tracking webhook URL',
      webhookNeedsDomain:
        'Webhooks only work once your store is live on a public domain; the courier cannot reach localhost or a preview URL.',
    },
    rateLimited: 'Too many attempts. Wait a few minutes and try again.',
  },
  overview: {
    title: 'Shadowfax',
    subtitle: 'Forward and return bookings, labels, tracking and NDR on Shadowfax’s network.',
    notConnected: 'Not connected yet. Add your account details to start booking shipments.',
    connectCta: 'Connect your account',
    connected: 'Connected',
    connectedAndTested: 'Connected ✓ tested',
    goToShipments: 'Open the Shipments workspace',
    goToShipmentsHelp: 'Book, track and manage every Shadowfax shipment from Orders → Shipments.',
    capabilitiesHeading: 'What this app can do',
    capabilities: {
      serviceability: 'Check if a PIN code is deliverable',
      create_shipment: 'Book a shipment and get an AWB; Shadowfax schedules the pickup',
      label: 'Print the shipping label (until the parcel is picked up)',
      tracking: 'Track scans automatically, a few times a day',
      webhook: 'Get near-instant tracking updates if you turn on the webhook',
      cancel: 'Cancel a shipment, even one already moving (Shadowfax stops it at the next hub)',
      ndr: 'Reattempt delivery, update the address or send it back from the NDR queue',
      reverse_pickup: 'Book a courier pickup for a customer return',
    } as Record<string, string>,
    notYetSupported: 'Not yet available for Shadowfax',
    notYetSupportedItems: [
      'Rates and delivery days (Shadowfax has no price lookup; checkout uses your own shipping rates)',
      'Wallet balance',
    ],
    webhookUrlLabel: 'Tracking webhook URL',
    webhookWhere: 'Paste into the Shadowfax client portal → Webhook',
    webhookUrlHelp:
      'Paste this into the Webhook tab of the Shadowfax client portal, with the same key as the Authorization header, so scans reach this app within minutes instead of waiting for the next check.',
    copied: 'Copied',
  },
}
