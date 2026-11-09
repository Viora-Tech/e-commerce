/** Copy for the ShipGlobal app (Apps → ShipGlobal). Hindi overlay: `hi/shipglobal.ts`. */
export const shipglobalAppContent = {
  connect: {
    title: 'Connect ShipGlobal',
    intro: 'Ship orders abroad with your own ShipGlobal account. Three steps, about five minutes.',
    dashboardUrl: 'https://v2.app.shipglobal.in/auth/login',
    signupUrl: 'https://v2.app.shipglobal.in/auth/signup',
    openDashboard: 'Open ShipGlobal',
    noAccount: "Don't have a ShipGlobal account?",
    signUp: 'Sign up',
    steps: {
      one: {
        title: 'Sign in to ShipGlobal',
        body: 'Sign in to your ShipGlobal account and finish its KYC (GSTIN and IEC), so ShipGlobal can file your exports.',
      },
      two: {
        title: 'Copy the API username and password',
        body: 'In ShipGlobal, open Settings › API and copy the API username and API password. Ask ShipGlobal support if you see no API section.',
        warning:
          'ShipGlobal has no test mode for its API: every booking is a real label, paid from your ShipGlobal wallet.',
      },
      three: {
        title: 'Paste them below and add your export details',
        body: 'Add the PIN code and city parcels leave from, your IEC and the service to book by default. Then use "Test connection".',
      },
    },
    stepDone: 'Done',
    stepLabel: (n: number) => `Step ${n}`,
    fields: {
      username: { label: 'API username', help: 'From ShipGlobal › Settings › API.' },
      password: {
        label: 'API password',
        help: 'Shown next to the API username. Stored encrypted.',
      },
      addressNickname: {
        label: 'Pickup address nickname',
        help: 'Optional. The nickname of a saved ShipGlobal pickup address. Leave blank to use your default one.',
      },
      customerNickname: {
        label: 'Customer nickname',
        help: 'Franchise accounts only, as ShipGlobal gave it. Leave blank otherwise.',
      },
      originPincode: {
        label: 'Origin PIN code',
        help: 'The 6-digit PIN code your parcels leave from.',
      },
      originCity: { label: 'Origin city', help: 'The city of that PIN code.' },
      iec: {
        label: 'IEC (Importer-Exporter Code)',
        help: 'Your 10-character code from DGFT. Indian customs needs it to clear a commercial export.',
      },
      iossNumber: {
        label: 'IOSS number',
        help: 'Optional. For parcels to the EU, if you are registered for IOSS.',
      },
      service: {
        label: 'Default service',
        help: 'Booked when you don’t pick one from the live rates in Create shipment.',
      },
    },
    testConnection: 'Test connection',
    testing: 'Testing…',
    testHint: 'We ask ShipGlobal for a sample rate with this login. Nothing is booked or charged.',
    rateLimited: 'Too many attempts. Wait a few minutes and try again.',
  },
  overview: {
    title: 'ShipGlobal',
    subtitle:
      'Ship orders abroad with ShipGlobal: live rates, export bookings with customs lines, labels and tracking.',
    notConnected:
      'Not connected yet. Add your ShipGlobal API username and password to start shipping abroad.',
    connectCta: 'Connect your account',
    connected: 'Connected',
    connectedAndTested: 'Connected ✓ tested',
    goToShipments: 'Open the Shipments workspace',
    goToShipmentsHelp:
      'Orders going abroad show every ShipGlobal service in Create shipment with its live price. Domestic orders keep using your Indian courier.',
    capabilitiesHeading: 'What this app can do',
    capabilities: {
      serviceability: 'Offer ShipGlobal for orders going abroad',
      rates: 'Live prices and transit times for every ShipGlobal service',
      create_shipment: 'Book an export with the customs lines filled from your products',
      label: 'Pay for the label from your ShipGlobal wallet and print it from the order',
      tracking: 'Tracking updates on the order, automatically',
      cancel: 'Cancel a label from here, refunded to your ShipGlobal wallet',
      international: 'Exports from India, with HS codes and IOSS sent per order',
    } as Record<string, string>,
    notYetSupported: 'Not yet available for ShipGlobal',
    notYetSupportedItems: [
      'Pickups: book them in ShipGlobal',
      'Domestic parcels and cash on delivery',
    ],
    copied: 'Copied',
  },
}
