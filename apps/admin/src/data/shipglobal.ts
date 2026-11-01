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
        title: 'Copy the API login',
        body: 'In ShipGlobal, open Settings › API and copy the API login (an email) and API password. Ask ShipGlobal support if you see no API section.',
        warning: 'ShipGlobal has no test mode for its API: every booking is a real label.',
      },
      three: {
        title: 'Paste them below and add your export details',
        body: 'Add your seller nickname, the PIN code and city parcels leave from, your IEC and the service to book. Then use "Test connection".',
      },
    },
    stepDone: 'Done',
    stepLabel: (n: number) => `Step ${n}`,
    fields: {
      email: { label: 'API login (email)', help: 'From ShipGlobal › Settings › API.' },
      password: { label: 'API password', help: 'Shown next to the API login. Stored encrypted.' },
      sellerNickname: {
        label: 'Seller nickname',
        help: 'Your seller name on ShipGlobal, sent with every order. Your store name if unsure.',
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
        label: 'Service',
        help: 'Who carries your parcels abroad. USPS and UPS go to the US only: we pick USPS up to 5 kg and UPS above.',
      },
    },
    testConnection: 'Test connection',
    testing: 'Testing…',
    testHint:
      'We sign in to ShipGlobal with this API login. Nothing is booked, and your seller details are checked when you first book.',
    rateLimited: 'Too many attempts. Wait a few minutes and try again.',
  },
  overview: {
    title: 'ShipGlobal',
    subtitle: 'Ship orders abroad with ShipGlobal: export bookings with customs lines, and labels.',
    notConnected: 'Not connected yet. Add your ShipGlobal API login to start shipping abroad.',
    connectCta: 'Connect your account',
    connected: 'Connected',
    connectedAndTested: 'Connected ✓ tested',
    goToShipments: 'Open the Shipments workspace',
    goToShipmentsHelp:
      'Orders going abroad show ShipGlobal in Create shipment, priced on booking. Domestic orders keep using your Indian courier.',
    capabilitiesHeading: 'What this app can do',
    capabilities: {
      serviceability: 'Check that your ShipGlobal service goes to the shopper’s country',
      create_shipment: 'Book an export with the customs lines filled from your products',
      label: 'Print the label from the order',
      international: 'Exports from India, with HS codes, GSTIN, IEC and IOSS sent per order',
    } as Record<string, string>,
    notYetSupported: 'Not yet available for ShipGlobal',
    notYetSupportedItems: [
      'Live rates: ShipGlobal’s API has no rate lookup, so the price shows after booking in ShipGlobal',
      'Automatic tracking: set each parcel’s status below',
      'Cancelling from here: cancel a label in your ShipGlobal panel',
      'Pickups: book them in ShipGlobal',
      'Domestic parcels and cash on delivery',
    ],
    copied: 'Copied',
  },
  parcels: {
    heading: 'Parcels on the way',
    help: 'ShipGlobal sends us no tracking, so move each parcel along here. Delivered closes the order; returned starts the RTO.',
    empty: 'No ShipGlobal parcels on the way.',
    loadFailed: 'Could not load your parcels.',
    order: (n: number) => `Order #${n}`,
    status: 'Status',
    update: 'Update',
    saving: 'Saving…',
    saved: 'Status updated',
    track: 'Track on ShipGlobal',
    trackHelp: 'ShipGlobal’s tracker opens empty: paste the tracking number there.',
    label: 'Label',
    copyNumber: 'Tracking number',
    statuses: {
      created: 'Booked',
      picked_up: 'Picked up',
      in_transit: 'In transit',
      out_for_delivery: 'Out for delivery',
      delivered: 'Delivered',
      rto: 'Returned to you',
    } as Record<string, string>,
  },
}
