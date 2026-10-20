/** Copy for the DHL Express app (Apps → DHL Express). Hindi overlay: `hi/dhl-express.ts`. */
export const dhlExpressAppContent = {
  connect: {
    title: 'Connect DHL Express',
    intro: 'Ship orders abroad with your own DHL Express account. Three steps, about five minutes.',
    dashboardUrl: 'https://developer.dhl.com/api-reference/dhl-express-mydhl-api',
    signupUrl: 'https://mydhl.express.dhl/in/en/home.html',
    openDashboard: 'Open DHL developer portal',
    noAccount: "Don't have a DHL Express account?",
    signUp: 'Open one',
    steps: {
      one: {
        title: 'Ask DHL for MyDHL API access',
        body: 'Sign in to developer.dhl.com, create an app and add "DHL Express - MyDHL API". DHL sends test keys at once; live keys come after your DHL account manager approves.',
      },
      two: {
        title: 'Copy the API key and secret',
        body: 'Open the app on developer.dhl.com and copy its API key and API secret. You also need your 9-digit DHL Express account number.',
        warning: 'Test keys only work in Test mode, live keys only in Live mode.',
      },
      three: {
        title: 'Paste them below and add your export details',
        body: 'Add the PIN code and city parcels leave from, and your IEC for the customs invoice. Then use "Test connection".',
      },
    },
    stepDone: 'Done',
    stepLabel: (n: number) => `Step ${n}`,
    fields: {
      apiKey: { label: 'API key', help: 'From your app on developer.dhl.com.' },
      apiSecret: { label: 'API secret', help: 'Shown next to the API key. Stored encrypted.' },
      accountNumber: {
        label: 'DHL account number',
        help: 'Your 9-digit DHL Express shipper account. Shipments are billed to it.',
      },
      originPincode: {
        label: 'Origin PIN code',
        help: 'The 6-digit PIN code your parcels leave from.',
      },
      originCity: {
        label: 'Origin city',
        help: 'The city of that PIN code. DHL needs both to quote.',
      },
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
        test: "Using DHL's sandbox: no real parcels, no charges. Tracking only works for DHL's own test waybills.",
        live: 'Using your live DHL Express account. Real shipments and real charges.',
      },
    },
    pickup: {
      label: 'Book a DHL pickup with each shipment',
      help: 'DHL collects from the pickup address on the day you book. Turn off if you drop parcels at a DHL point or have a daily pickup.',
    },
    testConnection: 'Test connection',
    testing: 'Testing…',
    testHint:
      'We check your keys with a read-only address lookup at DHL. Nothing is booked, and your account number is checked when you first book.',
    rateLimited: 'Too many attempts. Wait a few minutes and try again.',
  },
  overview: {
    title: 'DHL Express',
    subtitle:
      'Ship orders abroad: DHL rates, labels with the commercial invoice, pickups and tracking.',
    notConnected: 'Not connected yet. Add your DHL Express keys to start shipping abroad.',
    connectCta: 'Connect your account',
    connected: 'Connected',
    connectedAndTested: 'Connected ✓ tested',
    goToShipments: 'Open the Shipments workspace',
    goToShipmentsHelp:
      'Orders going abroad show DHL Express rates in Create shipment. Domestic orders keep using your Indian courier.',
    capabilitiesHeading: 'What this app can do',
    capabilities: {
      serviceability: 'Check that DHL delivers to the shopper’s country and postal code',
      rates: 'Compare DHL Express services with price and transit days, in rupees',
      create_shipment: 'Book a shipment with the customs lines filled from your products',
      label: 'Print the label and commercial invoice as one PDF',
      tracking: 'Track a shipment (checked on a schedule - DHL sends no webhook)',
      cancel: 'Cancel the pickup of a parcel that has not left',
      international:
        'Exports from India, with HS codes, country of origin, GSTIN and IEC on the invoice',
    } as Record<string, string>,
    notYetSupported: 'Not yet available for DHL Express',
    notYetSupportedItems: [
      'Domestic parcels inside India (DHL Express does not carry them)',
      'Duties paid by you (DDP): the shopper pays any import duty',
      'Cash on delivery',
    ],
    copied: 'Copied',
  },
}
