/** Copy for the side cards of a courier app's Connect page (Figma "Delhivery · Connect"). */
export const connectAsideContent = {
  connection: 'Connection',
  connected: 'Connected',
  notConnected: 'Not connected',
  mode: 'Mode',
  test: 'Test',
  live: 'Live',
  originPin: 'Origin PIN',
  pickup: 'Pickup location',
  lastChecked: 'Last checked',
  notChecked: 'Not checked yet',
  testAgain: 'Test again',
  testing: 'Testing…',
  connectsTitle: 'What this connects',
  guide: 'View setup guide',
  /** Under the Origin PIN code box while it is not six digits. */
  pinInvalid: 'Enter a 6-digit PIN code.',
  /** What each courier's account links, and where to find its key, by provider id. */
  providers: {
    delhivery: {
      connects: [
        'PIN serviceability at checkout',
        'Book pickups and print labels',
        'Live tracking on every order',
        'Failed delivery (NDR) follow-ups',
      ],
      helpTitle: 'Where is my API token?',
      helpBody:
        'In Delhivery One, open Settings, then API Setup. Ask your Delhivery manager to turn on API access if you do not see it.',
    },
    shiprocket: {
      connects: [
        'Courier rates from every Shiprocket partner',
        'Book shipments and print labels',
        'Tracking and failed delivery (NDR) follow-ups',
        'Your Shiprocket wallet balance',
      ],
      helpTitle: 'Where do I get the API user?',
      helpBody:
        'In Shiprocket, open Settings › API › Configure and add an API user. Use its email and password here, never your own login.',
    },
    rapidshyp: {
      connects: [
        'Courier rates across the RapidShyp network',
        'Book shipments and print labels',
        'Cancel a booking before pickup',
      ],
      helpTitle: 'Where is my API key?',
      helpBody: 'In your RapidShyp dashboard, open Settings › API and copy the key shown there.',
    },
    bluedart: {
      connects: [
        'PIN serviceability and delivery dates at checkout',
        'Book waybills with the label PDF',
        'Pickups registered with every booking',
        'Tracking on every order',
      ],
      helpTitle: 'Where are my Blue Dart keys?',
      helpBody:
        'Create an app for the Blue Dart APIs on the DHL developer portal (developer.dhl.com, My Apps) for the Client ID and secret. The Login ID, licence key, customer code and area code come from your Blue Dart account manager.',
    },
    dtdc: {
      connects: [
        'PIN serviceability at checkout',
        'Book consignments and print labels',
        'Tracking on every order',
        'Cancel a booking before pickup',
      ],
      helpTitle: 'Where is my DTDC API key?',
      helpBody:
        'DTDC sends the API key, customer code and the tracking username and password when your account manager turns on API access. Ask them if you have not received it.',
    },
    'india-post': {
      connects: [
        'Every Indian PIN code, with its post office',
        'Speed Post rates from India Post’s tariff',
        'Address labels with a barcode, COD on the label',
        'Parcel status you set, on every order',
      ],
      helpTitle: 'Where do I get a data.gov.in key?',
      helpBody:
        'Sign up free at data.gov.in, open My Account, and copy the API key shown there. It is optional: without it rates and delivery times still work.',
    },
  } as Record<string, { connects: string[]; helpTitle: string; helpBody: string }>,
} as const
