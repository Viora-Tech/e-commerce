/** Copy for the Blue Dart app (Apps → Blue Dart). Hindi overlay: data/hi/bluedart.ts. */
export const bluedartAppContent = {
  connect: {
    title: 'Connect Blue Dart',
    intro:
      'Follow the three steps below to link your Blue Dart account. You need API access from Blue Dart first.',
    dashboardUrl: 'https://developer.dhl.com/',
    signupUrl: 'https://www.bluedart.com/',
    openDashboard: 'Open the DHL developer portal',
    noAccount: "Don't have a Blue Dart business account?",
    signUp: 'Contact Blue Dart',
    steps: {
      one: {
        title: 'Create an app on the DHL developer portal',
        body: 'Blue Dart’s API Gateway lives on developer.dhl.com. Sign in, open My Apps and create an app with the Blue Dart APIs (Waybill, Pickup, Tracking, Location Finder, Transit Time).',
      },
      two: {
        title: 'Copy the Client ID and secret, and your Blue Dart details',
        body: 'The app shows a Consumer Key (Client ID) and secret. Your Blue Dart account manager gives you the Login ID, licence key, customer code and the area code of the PIN code you ship from.',
        warning:
          'The licence key is tied to your customer code. A key from another Blue Dart account books shipments on that account.',
      },
      three: {
        title: 'Paste them below and test',
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
        test: 'Using Blue Dart’s sandbox. Use sandbox keys - live keys do not work there.',
        live: 'Using your live Blue Dart account. Real waybills and real charges.',
      },
    },
    fields: {
      clientId: {
        label: 'Client ID',
        help: 'DHL developer portal → My Apps → your app → Consumer Key.',
      },
      clientSecret: {
        label: 'Client secret',
        help: 'Shown next to the Client ID. Stored encrypted.',
      },
      loginId: {
        label: 'Login ID',
        help: 'From Blue Dart with your API access.',
      },
      licenceKey: {
        label: 'Licence key',
        help: 'From Blue Dart with your API access. Stored encrypted.',
      },
      customerCode: {
        label: 'Customer code',
        help: 'Your Blue Dart billing customer code.',
      },
      originArea: {
        label: 'Origin area code',
        help: 'Blue Dart’s 3-letter area code for the PIN code you ship from, such as DEL or BOM. Ask your account manager if you are not sure.',
      },
      originPincode: {
        label: 'Origin PIN code',
        help: 'The 6-digit PIN code your parcels ship from. We use this to test the connection and to estimate delivery dates.',
      },
    },
    testConnection: 'Test connection',
    testing: 'Testing…',
    testHint:
      'We check this by signing in to Blue Dart and looking up your origin PIN code - nothing is booked. The area code is only checked when you book a waybill.',
    advanced: {
      trigger: 'Advanced',
      baseUrlLabel: 'API base URL',
      baseUrlHelp: 'Set automatically by the Test/Live switch above. Leave blank for production.',
      surfaceLabel: 'Book Surface instead of Apex (air)',
      surfaceHelp: 'Off books Apex, Blue Dart’s air service. Surface is slower and cheaper.',
      registerPickupLabel: 'Register a pickup with every waybill',
      registerPickupHelp:
        'On: Blue Dart is asked to collect each parcel when you book it. Off: schedule pickups yourself from Shipments.',
      pickupAddressLabel: 'Pickup address',
      pickupAddressHelp: 'Where Blue Dart collects from when you schedule a pickup from Shipments.',
      pickupPhoneLabel: 'Pickup phone',
      pickupPhoneHelp: 'The number the Blue Dart pickup executive calls.',
    },
    rateLimited: 'Too many attempts. Wait a few minutes and try again.',
  },
  overview: {
    title: 'Blue Dart',
    subtitle:
      'Serviceability, waybills with labels, pickups and tracking on your Blue Dart account.',
    notConnected: 'Not connected yet. Add your account details to start booking shipments.',
    connectCta: 'Connect your account',
    connected: 'Connected',
    connectedAndTested: 'Connected ✓ tested',
    goToShipments: 'Open the Shipments workspace',
    goToShipmentsHelp: 'Book, track and manage every Blue Dart shipment from Orders → Shipments.',
    capabilitiesHeading: 'What this app can do',
    capabilities: {
      serviceability: 'Check if a PIN code is deliverable, with Blue Dart’s expected delivery date',
      create_shipment: 'Book a waybill, prepaid or cash on delivery',
      label: 'Print the Blue Dart label (kept with the shipment)',
      pickup: 'Register a pickup with each booking, or schedule one from Shipments',
      tracking: 'Track scans automatically, a few times a day',
      cancel: 'Cancel a waybill before it is picked up',
    } as Record<string, string>,
    notYetSupported: 'Not yet available for Blue Dart',
    notYetSupportedItems: [
      'Courier rates before booking (Blue Dart has no rate API; checkout uses your shipping rates)',
      'Acting on failed deliveries (NDR) from the app: they show on the shipment, act on them with Blue Dart',
      'Instant tracking by webhook (Blue Dart sets this up per account; the app checks on a schedule)',
    ],
  },
}
