/** Copy for the DTDC app (Apps → DTDC). Hindi overlay: data/hi/dtdc.ts. */
export const dtdcAppContent = {
  connect: {
    title: 'Connect DTDC',
    intro:
      'Follow the three steps below to link your DTDC account. You need API access from DTDC first.',
    dashboardUrl: 'https://www.dtdc.in/',
    signupUrl: 'https://www.dtdc.in/',
    openDashboard: 'Open DTDC',
    noAccount: "Don't have a DTDC business account?",
    signUp: 'Contact DTDC',
    steps: {
      one: {
        title: 'Ask DTDC for API access',
        body: 'Your DTDC account manager turns on API (softdata) access for your customer code and emails the API key.',
      },
      two: {
        title: 'Find the API key and tracking login',
        body: 'The same mail has your customer code, the API key, and a separate username and password for DTDC’s tracking service.',
        warning:
          'Without the tracking username and password you can still book and print labels, but shipments will not track.',
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
        test: 'Using DTDC’s demo server. Use a demo API key - the live one does not work there.',
        live: 'Using your live DTDC account. Real bookings and real charges.',
      },
    },
    fields: {
      apiKey: {
        label: 'API key',
        help: 'From DTDC with your API access. Stored encrypted.',
      },
      customerCode: {
        label: 'Customer code',
        help: 'Your DTDC customer code, for example GL1234.',
      },
      originPincode: {
        label: 'Origin PIN code',
        help: 'The 6-digit PIN code your parcels ship from. We use this to test the connection.',
      },
      trackingUsername: {
        label: 'Tracking username',
        help: 'DTDC’s tracking service has its own login, sent with your API key.',
      },
      trackingPassword: {
        label: 'Tracking password',
        help: 'Stored encrypted.',
      },
    },
    testConnection: 'Test connection',
    testing: 'Testing…',
    testHint:
      'We check the API key and the tracking login with DTDC, and that DTDC serves your origin PIN code - nothing is booked.',
    advanced: {
      trigger: 'Advanced',
      baseUrlLabel: 'API base URL',
      baseUrlHelp: 'Set automatically by the Test/Live switch above. Leave blank for production.',
      serviceTypeLabel: 'Service type',
      serviceTypeHelp:
        'DTDC’s service name for your bookings, exactly as on your contract (for example B2C PRIORITY or GROUND EXPRESS). Blank books B2C PRIORITY.',
    },
    rateLimited: 'Too many attempts. Wait a few minutes and try again.',
  },
  overview: {
    title: 'DTDC',
    subtitle:
      'Serviceability, bookings with labels, tracking and cancellation on your DTDC account.',
    notConnected: 'Not connected yet. Add your account details to start booking shipments.',
    connectCta: 'Connect your account',
    connected: 'Connected',
    connectedAndTested: 'Connected ✓ tested',
    goToShipments: 'Open the Shipments workspace',
    goToShipmentsHelp: 'Book, track and manage every DTDC shipment from Orders → Shipments.',
    capabilitiesHeading: 'What this app can do',
    capabilities: {
      serviceability: 'Check if a PIN code is deliverable and takes cash on delivery',
      create_shipment: 'Book a consignment, prepaid or cash on delivery',
      label: 'Print the DTDC label (kept with the shipment)',
      tracking: 'Track scans automatically, a few times a day',
      cancel: 'Cancel a booking before it is picked up',
    } as Record<string, string>,
    notYetSupported: 'Not yet available for DTDC',
    notYetSupportedItems: [
      'Courier rates before booking (no DTDC rate API; checkout uses your shipping rates)',
      'Scheduling pickups from the app (DTDC collects on your account’s daily pickup)',
      'Acting on failed deliveries (NDR) from the app: they show on the shipment, act on them with DTDC',
    ],
  },
}
