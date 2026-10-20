/** Copy for the Xpressbees app (Apps → Xpressbees); Hindi in `data/hi/xpressbees.ts`. */
export const xpressbeesAppContent = {
  connect: {
    title: 'Connect Xpressbees',
    intro: 'Follow the three steps below to link your Xpressbees account. It takes about a minute.',
    dashboardUrl: 'https://shipment.xpressbees.com/',
    signupUrl: 'https://www.xpressbees.com/',
    openDashboard: 'Open Xpressbees',
    noAccount: "Don't have an Xpressbees account?",
    signUp: 'Sign up',
    steps: {
      one: {
        title: 'Ask for API access',
        body: 'Sign in to shipment.xpressbees.com. API access is turned on by your Xpressbees account manager; ask them if you have not used the API before.',
      },
      two: {
        title: 'Note your login and pickup warehouse',
        body: 'We connect with the email and password you sign in with. Under Warehouses, copy the exact name of the warehouse your parcels leave from.',
      },
      three: {
        title: 'Paste them below',
        body: 'Fill in the fields, then use "Test connection" to make sure everything works before saving.',
      },
    },
    stepDone: 'Done',
    stepLabel: (n: number) => `Step ${n}`,
    fields: {
      email: {
        label: 'Login email',
        help: 'The email you sign in to shipment.xpressbees.com with.',
      },
      password: {
        label: 'Password',
        help: 'Your Xpressbees password. It is stored encrypted and never shown again.',
      },
      warehouseName: {
        label: 'Pickup warehouse name',
        help: 'Must match the warehouse name on the Xpressbees dashboard exactly.',
      },
      originPincode: {
        label: 'Origin PIN code',
        help: 'The 6-digit PIN code your parcels ship from. We use this to test the connection and to compare rates.',
      },
    },
    testConnection: 'Test connection',
    testing: 'Testing…',
    testHint:
      'We check this by signing in and asking for rates on your own PIN code. Nothing is booked. The warehouse name is only checked when you book a shipment.',
    advanced: {
      trigger: 'Advanced',
      baseUrlLabel: 'API base URL',
      baseUrlHelp: 'Leave blank for production.',
      webhookSecretLabel: 'Webhook secret',
      webhookSecretHelp:
        'Required for automatic tracking updates. Set the same secret on the Xpressbees webhook page; a call that is not signed with it is refused.',
      webhookUrlLabel: 'Tracking webhook URL',
      webhookNeedsDomain:
        'Webhooks only work once your store is live on a public domain; the courier cannot reach localhost or a preview URL.',
    },
    rateLimited: 'Too many attempts. Wait a few minutes and try again.',
  },
  overview: {
    title: 'Xpressbees',
    subtitle: 'Surface, Air and same-day rates, bookings with auto pickup, tracking and NDR.',
    notConnected: 'Not connected yet. Add your account details to start booking shipments.',
    connectCta: 'Connect your account',
    connected: 'Connected',
    connectedAndTested: 'Connected ✓ tested',
    goToShipments: 'Open the Shipments workspace',
    goToShipmentsHelp: 'Book, track and manage every Xpressbees shipment from Orders → Shipments.',
    capabilitiesHeading: 'What this app can do',
    capabilities: {
      serviceability: 'Check if a PIN code is deliverable, with COD availability',
      rates: 'Compare prices across Xpressbees services (Surface, Air, same day)',
      create_shipment: 'Book a shipment and get an AWB; pickup is requested automatically',
      label: 'Print the shipping label',
      tracking: 'Track scans automatically, a few times a day',
      webhook: 'Get near-instant tracking updates if you turn on the webhook',
      cancel: 'Cancel a booked shipment before pickup',
      ndr: 'Reattempt delivery, change the address or phone from the NDR queue',
    } as Record<string, string>,
    notYetSupported: 'Not yet available for Xpressbees',
    notYetSupportedItems: [
      'Return pickups (not confirmed on the Xpressbees API yet)',
      'Wallet balance',
      'Delivery days at checkout (Xpressbees does not send them; your own transit days are used)',
    ],
    webhookUrlLabel: 'Tracking webhook URL',
    webhookWhere: 'Paste into the Xpressbees dashboard → Settings → Webhook',
    webhookUrlHelp:
      'Paste this into the Xpressbees webhook settings with the same secret you set on the Connect page, so scans reach this app within minutes instead of waiting for the next check.',
    copied: 'Copied',
  },
}
