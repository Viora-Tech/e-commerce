/** Copy for the Delhivery app (Apps → Delhivery). */
export const delhiveryAppContent = {
  connect: {
    title: 'Connect Delhivery',
    intro: 'Follow the three steps below to link your Delhivery account. It takes about a minute.',
    dashboardUrl: 'https://one.delhivery.com',
    signupUrl: 'https://one.delhivery.com/register',
    openDashboard: 'Open Delhivery One',
    noAccount: "Don't have a Delhivery account?",
    signUp: 'Sign up',
    steps: {
      one: {
        title: 'Open Delhivery One',
        body: 'Sign in to your Delhivery account in a new tab.',
      },
      two: {
        title: 'Copy your API token',
        body: 'Go to Settings › API Setup and copy the token shown there.',
        warning:
          'It\'s shown only once and stays visible for about 5 minutes, so copy it straight away. If it disappears, click "Request Live API Token" to get a new one - the old one stops working the moment you do.',
      },
      three: {
        title: 'Paste it below and pick your pickup location',
        body: 'Fill in the fields, then use "Test connection" to make sure everything works before saving.',
      },
    },
    stepDone: 'Done',
    stepLabel: (n: number) => `Step ${n}`,
    mode: {
      label: 'Mode',
      test: 'Test',
      live: 'Live',
      help: {
        test: 'Using the staging environment. Use a staging API token, not your live one - the two are not interchangeable.',
        live: 'Using your live Delhivery account. Real shipments and real charges.',
      },
    },
    fields: {
      apiToken: {
        label: 'API token',
        help: 'Delhivery One → Settings → API Setup. Paste it right after copying - it disappears after about 5 minutes.',
      },
      clientName: {
        label: 'Client name',
        help: "Usually shown next to your API token on the same API Setup page. Ask your Delhivery account manager if you can't find it.",
      },
      pickupLocationName: {
        label: 'Pickup location name',
        help: 'Must match your registered warehouse name in Delhivery exactly, including spacing and capitalisation. Ask your Delhivery account manager (SPOC) if you are not sure.',
      },
      originPincode: {
        label: 'Origin PIN code',
        help: 'The 6-digit PIN code your parcels ship from. We use this to test the connection and to estimate delivery dates.',
      },
    },
    testConnection: 'Test connection',
    testing: 'Testing…',
    testSuccess: (pin: string) => `Connected — Delhivery serves ${pin}.`,
    testHint:
      "We check this by asking Delhivery whether it serves your origin PIN code - nothing is booked. This can't confirm the pickup location name; Delhivery only checks that when you book a shipment.",
    advanced: {
      trigger: 'Advanced',
      baseUrlLabel: 'API base URL',
      baseUrlHelp: 'Set automatically by the Test/Live switch above. Leave blank for production.',
      expressLabel: 'Quote Express transit times',
      expressHelp: 'Off quotes Surface, the slower and safer promise.',
      webhookSecretLabel: 'Webhook shared secret',
      webhookSecretHelp:
        'Optional. Paste the same value into the extra header field when you register the tracking webhook in the Delhivery Merchant Portal (API → Webhooks).',
      webhookUrlLabel: 'Tracking webhook URL',
      webhookNeedsDomain:
        'Webhooks only work once your store is live on a public domain - Delhivery cannot reach localhost or a preview URL.',
    },
    rateLimited: 'Too many attempts. Wait a few minutes and try again.',
  },
  overview: {
    title: 'Delhivery',
    subtitle: 'Serviceability, pickups, tracking and NDR on your Delhivery account.',
    notConnected: 'Not connected yet. Add your account details to start booking shipments.',
    connectCta: 'Connect your account',
    connected: 'Connected',
    connectedAndTested: 'Connected ✓ tested',
    goToShipments: 'Open the Shipments workspace',
    goToShipmentsHelp: 'Book, track and manage every Delhivery shipment from Orders → Shipments.',
    capabilitiesHeading: 'What this app can do',
    capabilities: {
      serviceability: 'Check if a PIN code is deliverable, with an estimated delivery date',
      create_shipment: 'Book a shipment and get a waybill',
      label: 'Print the shipping label',
      pickup: 'Schedule a pickup with your local hub',
      tracking: 'Track scans automatically, a few times a day',
      webhook: 'Get near-instant tracking updates if you turn on the webhook',
      cancel: 'Cancel a shipment before it is picked up',
      ndr: 'Reattempt delivery, change the address, or send a parcel back (RTO) from the NDR queue',
      manifest: 'Not available from Delhivery yet: we print a label sheet from what you booked',
      wallet:
        'Not available from Delhivery yet: enter your balance by hand to get low-balance alerts',
    } as Record<string, string>,
    webhookUrlLabel: 'Tracking webhook URL',
    webhookUrlHelp:
      'Paste this into Delhivery One → API → Webhooks, along with the same shared secret you set on the connect page, so scans reach this app within minutes instead of waiting for the next poll.',
    copied: 'Copied',
  },
}
