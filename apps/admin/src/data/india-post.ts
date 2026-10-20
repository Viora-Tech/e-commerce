/** Copy for the India Post app (Apps → India Post): Connect, Parcels and the label page. */
export const indiaPostAppContent = {
  connect: {
    title: 'Set up India Post',
    intro:
      'India Post has no booking API for online shops, so you book each parcel at the post office and we do the rest: rates, labels and status.',
    dashboardUrl: 'https://www.indiapost.gov.in/',
    signupUrl: 'https://www.indiapost.gov.in/',
    openDashboard: 'Open India Post',
    noAccount: 'Want contract rates and COD?',
    signUp: 'Ask India Post about a business account',
    steps: {
      one: {
        title: 'Pick your post office',
        body: 'Enter the PIN code of the post office where you hand in parcels. Rates and delivery times are worked out from it.',
      },
      two: {
        title: 'Add your business account, if you have one',
        body: 'With an India Post business (BNPL) customer ID you get contract rates and can collect cash on delivery. Without one, counter rates apply and every parcel is prepaid.',
      },
      three: {
        title: 'Test and save',
        body: 'Use "Test connection" to check the PIN code, then save. Book parcels from any order with Create shipment.',
      },
    },
    stepDone: 'Done',
    stepLabel: (n: number) => `Step ${n}`,
    fields: {
      originPincode: {
        label: 'Post office PIN code',
        help: 'Where you book parcels. 6 digits.',
      },
      customerId: {
        label: 'Speed Post customer ID',
        help: 'Optional. Your India Post business (BNPL) customer ID; printed on the label.',
      },
      contractRates: {
        label: 'I have contract rates',
        help: 'Price parcels from India Post’s contractual card instead of the counter rates.',
      },
      codEnabled: {
        label: 'Collect cash on delivery',
        help: 'Only when your India Post business account collects COD for you.',
      },
      codFeeRupees: {
        label: 'COD fee per parcel (₹)',
        help: 'What India Post charges you per COD parcel, from your agreement.',
      },
      dataGovApiKey: {
        label: 'data.gov.in API key',
        help: 'Optional and free: sign up at data.gov.in and copy your key. With it we show the post office for each PIN code.',
      },
    },
    testConnection: 'Test connection',
    testing: 'Testing…',
    testHint:
      'We check the PIN code against India Post’s directory. Nothing is booked and no India Post account is needed.',
    advanced: {
      trigger: 'Your own rates',
      tariffLabel: 'Rate card (JSON)',
      tariffHelp:
        'Leave empty to use India Post’s published tariff (effective 1 August 2026). Paste your negotiated card in the same shape to replace it: weight slabs with rupees for local, withinState, metro and otherStates, plus additionalKgRupees.',
    },
    rateLimited: 'Too many attempts. Wait a few minutes and try again.',
  },
  overview: {
    title: 'India Post',
    subtitle: 'Speed Post parcels to every PIN code in India, booked at your post office.',
    notConnected: 'Not set up yet. Add your post office PIN code to start.',
    connectCta: 'Set up India Post',
    connected: 'Ready',
    connectedAndTested: 'Ready ✓ tested',
    goToShipments: 'Open the Shipments workspace',
    goToShipmentsHelp:
      'Book a parcel from any order: pick India Post in Create shipment and type the article number from the receipt.',
    capabilitiesHeading: 'What this app can do',
    capabilities: {
      serviceability:
        'Check any Indian PIN code, with its post office and India Post delivery times',
      rates: 'Speed Post rates from India Post’s published tariff, or your own card',
      create_shipment: 'Record a parcel by its article number, checked digit by digit',
      label: 'Print an address label with a barcode',
      cancel: 'Cancel a parcel in your records so it can be booked again',
    } as Record<string, string>,
    notYetSupported: 'Not available for India Post',
    notYetSupportedItems: [
      'Booking from here: India Post’s booking API is only for contracted bulk customers',
      'Automatic tracking: set each parcel’s status below, from indiapost.gov.in',
    ],
  },
  parcels: {
    heading: 'Parcels on the way',
    help: 'India Post sends us no tracking, so move each parcel along here. Delivered closes the order; returned starts the RTO.',
    empty: 'No India Post parcels on the way.',
    loadFailed: 'Could not load your parcels.',
    order: (n: number) => `Order #${n}`,
    status: 'Status',
    update: 'Update',
    saving: 'Saving…',
    saved: 'Status updated',
    track: 'Track on India Post',
    trackHelp: 'India Post’s tracker opens empty: paste the article number there.',
    label: 'Label',
    copyNumber: 'Article number',
    statuses: {
      created: 'Booked',
      picked_up: 'Handed in at the post office',
      in_transit: 'In transit',
      out_for_delivery: 'Out for delivery',
      delivered: 'Delivered',
      rto: 'Returned to you',
    } as Record<string, string>,
  },
  label: {
    title: (n: string) => `Label ${n}`,
    loading: 'Making the label…',
    failed: 'Could not make the label.',
    download: 'Download PDF',
    print: 'Print',
    back: 'Back to parcels',
  },
}
