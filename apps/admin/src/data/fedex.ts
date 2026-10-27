/** Copy for the FedEx app (Apps → FedEx). Hindi overlay: `hi/fedex.ts`. */
export const fedexAppContent = {
  connect: {
    title: 'Connect FedEx',
    intro: 'Ship orders abroad with your own FedEx account. Three steps, about five minutes.',
    dashboardUrl: 'https://developer.fedex.com/api/en-in/home.html',
    signupUrl: 'https://www.fedex.com/en-in/open-account.html',
    openDashboard: 'Open FedEx Developer Portal',
    noAccount: "Don't have a FedEx account?",
    signUp: 'Open one',
    steps: {
      one: {
        title: 'Create a FedEx API project',
        body: 'Sign in to developer.fedex.com, create a project and pick Ship, Rate, Pickup Request and Track. Link your FedEx shipping account to it.',
      },
      two: {
        title: 'Copy the API key and secret key',
        body: 'The project shows a test key pair at once; the production pair appears once FedEx approves the project. You also need your 9-digit FedEx account number.',
        warning: 'Test keys only work in Test mode, production keys only in Live mode.',
      },
      three: {
        title: 'Paste them below and add your export details',
        body: 'Add the PIN code and city parcels leave from, and your IEC for the customs invoice. Then use "Test connection".',
      },
    },
    stepDone: 'Done',
    stepLabel: (n: number) => `Step ${n}`,
    fields: {
      clientId: { label: 'API key', help: 'From your project on developer.fedex.com.' },
      clientSecret: { label: 'Secret key', help: 'Shown next to the API key. Stored encrypted.' },
      accountNumber: {
        label: 'FedEx account number',
        help: 'The 9-digit account shipments are billed to. Only tracking parcels coming to you? Leave this and the origin empty: the API key and secret are enough.',
      },
      originPincode: {
        label: 'Origin PIN code',
        help: 'The 6-digit PIN code your parcels leave from.',
      },
      originCity: { label: 'Origin city', help: 'The city of that PIN code.' },
      iec: {
        label: 'IEC (Importer-Exporter Code)',
        help: 'Your 10-character code from DGFT, printed on the commercial invoice. Indian customs needs it to clear a commercial export.',
      },
    },
    mode: {
      label: 'Mode',
      test: 'Test',
      live: 'Live',
      help: {
        test: "Using FedEx's sandbox: no real parcels, no charges.",
        live: 'Using your live FedEx account. Real shipments and real charges.',
      },
    },
    pickup: {
      label: 'Request a FedEx pickup after each booking',
      help: 'Booked before 3 pm, FedEx collects the same day; later, the next day from 10 am. Turn off if you drop parcels at FedEx or have a regular pickup.',
    },
    testConnection: 'Test connection',
    testing: 'Testing…',
    testHint:
      'We check your API key and secret by asking FedEx for a sign-in token. Nothing is booked, and your account number is checked when you first quote or book.',
    rateLimited: 'Too many attempts. Wait a few minutes and try again.',
  },
  overview: {
    title: 'FedEx',
    subtitle:
      'Ship orders abroad: FedEx rates, labels with the commercial invoice, pickups, tracking and cancellation.',
    notConnected: 'Not connected yet. Add your FedEx keys to start shipping abroad.',
    connectCta: 'Connect your account',
    connected: 'Connected',
    connectedAndTested: 'Connected ✓ tested',
    goToShipments: 'Open the Shipments workspace',
    goToShipmentsHelp:
      'Orders going abroad show FedEx rates in Create shipment. Domestic orders keep using your Indian courier.',
    capabilitiesHeading: 'What this app can do',
    capabilities: {
      serviceability: 'Check that FedEx delivers to the shopper’s country and postal code',
      rates: 'Compare FedEx services with price and transit days, in rupees',
      create_shipment: 'Book a shipment with the customs lines filled from your products',
      label: 'Print the label and commercial invoice as one PDF',
      tracking: 'Track a shipment (checked on a schedule)',
      cancel: 'Cancel a shipment before FedEx collects it',
      international:
        'Exports from India, with HS codes, country of origin, GSTIN and IEC on the invoice',
    } as Record<string, string>,
    notYetSupported: 'Not yet available for FedEx',
    notYetSupportedItems: [
      'Domestic parcels inside India (FedEx no longer carries them)',
      'Duties paid by you (DDP): the shopper pays any import duty',
      'Cash on delivery',
    ],
    copied: 'Copied',
  },
}
