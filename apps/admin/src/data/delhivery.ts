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
      "We check this by asking Delhivery whether it serves your origin PIN code - nothing is booked. This can't confirm the pickup location name: Delhivery has no way to look one up without creating or changing it, so it is only checked when you book. If a booking says the name is wrong, it shows the exact name we sent; copy the right one from Delhivery One → Settings → Pickup locations.",
    advanced: {
      trigger: 'Advanced',
      baseUrlLabel: 'API base URL',
      baseUrlHelp: 'Set automatically by the Test/Live switch above. Leave blank for production.',
      expressLabel: 'Quote Express transit times',
      expressHelp: 'Off quotes Surface, the slower and safer promise.',
      webhookSecretLabel: 'Webhook shared secret',
      webhookSecretHelp:
        'Required for automatic tracking updates. Paste the same value into the extra header field when you register the tracking webhook in the Delhivery Merchant Portal (API → Webhooks); a webhook call without it is refused.',
      webhookUrlLabel: 'Tracking webhook URL',
      webhookNeedsDomain:
        'Webhooks only work once your store is live on a public domain - Delhivery cannot reach localhost or a preview URL.',
    },
    rateLimited: 'Too many attempts. Wait a few minutes and try again.',
  },
  /** Figma 928:11256 "Delhivery · Overview". */
  overview: {
    title: 'Overview',
    subtitle: "Your Delhivery account: wallet, today's parcels and where pickups happen.",
    notConnected: 'Not connected yet. Add your account details to start booking shipments.',
    connectCta: 'Connect your account',
    rechargeWallet: 'Recharge wallet',
    rechargeUrl: 'https://one.delhivery.com/',
    tiles: {
      wallet: 'Wallet',
      recharge: 'Recharge',
      lowAlert: (amount: string) => `Low-balance alert below ${amount}`,
      low: (amount: string) => `Below your ${amount} alert. Recharge before booking.`,
      notRecorded: 'Not recorded',
      notRecordedNote: 'Delhivery does not share it. Enter it to get low-balance alerts.',
      update: 'Update',
      bookedToday: 'Booked today',
      charged: (amount: string) => `${amount} charged`,
      noneToday: 'Nothing booked yet today',
      inTransit: 'In transit',
      delayed: (n: number) => `${n} delayed`,
      noneDelayed: 'None past the promised date',
      rto: 'RTO this month',
      rtoOf: (percent: string, n: number) => `${percent} of ${n}`,
      noneThisMonth: 'Nothing booked this month',
    },
    recent: {
      title: 'Recent shipments',
      viewAll: 'View all',
      columns: { awb: 'AWB', order: 'Order', status: 'Status', updated: 'Updated' },
      empty: 'No Delhivery shipments yet. Book one from Orders → Shipments.',
    },
    pickup: {
      title: 'Pickup locations',
      add: 'Add',
      default: 'Default',
      registered: 'registered',
      next: (when: string, n: number) =>
        `Next pickup: ${when} · ${n} ${n === 1 ? 'parcel' : 'parcels'}`,
      noNext: 'No pickup booked',
      empty:
        'No pickup location yet. Add the name registered in Delhivery One on the Connect page.',
    },
    connection: {
      title: 'Connection',
      edit: 'Edit',
      account: 'Account',
      apiKey: 'API key',
      works: 'works',
      saved: 'saved',
      tracking: 'Tracking updates',
      webhookOn: 'Receiving · webhook on',
      polled: 'Checked a few times a day',
      pickupName: 'Pickup location',
      unknown: 'Not set',
    },
    walletDialog: {
      title: 'Delhivery wallet balance',
      body: "Delhivery doesn't share your balance over its API. Copy it from Delhivery One so the low-balance alert works.",
      label: 'Balance',
      save: 'Save balance',
      saved: 'Balance saved',
    },
  },
  shipmentsPage: {
    title: 'Shipments',
    subtitle: 'Every parcel booked with Delhivery. Book new ones from Orders → Shipments.',
    openWorkspace: 'All couriers',
  },
  pickupsPage: {
    title: 'Pickups',
    subtitle: 'Book a Delhivery pickup for booked parcels, then print the manifest.',
  },
  pickupLocationsPage: {
    title: 'Pickup locations',
    subtitle:
      'Where Delhivery collects your parcels. Each name must match the warehouse name in Delhivery One exactly.',
    manage: 'Manage locations',
    changeDefault: 'Change on Connect',
    columns: {
      place: 'Location',
      registered: 'Name in Delhivery',
      address: 'City and PIN code',
      next: 'Next pickup',
    },
    next: (when: string, n: number) => `${when} · ${n} ${n === 1 ? 'parcel' : 'parcels'}`,
    none: 'None booked',
    empty:
      'No pickup location yet. Add the name registered in Delhivery One on the Connect page, or turn on courier pickup for a location.',
  },
}
