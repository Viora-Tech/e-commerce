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
    xpressbees: {
      connects: [
        'Rates for every Xpressbees service on a route',
        'Book shipments with automatic pickup and print labels',
        'Tracking and failed delivery (NDR) follow-ups',
      ],
      helpTitle: 'Which login do I use?',
      helpBody:
        'The email and password you sign in to shipment.xpressbees.com with. Your Xpressbees account manager turns on API access.',
    },
    ekart: {
      connects: [
        'Ekart price and delivery days at checkout',
        'Book shipments and return pickups',
        'Tracking and failed delivery (NDR) follow-ups',
      ],
      helpTitle: 'Where are my API credentials?',
      helpBody:
        'Ekart emails a client ID, API username and password at onboarding. Ask your Ekart account manager if you cannot find them.',
    },
    shadowfax: {
      connects: [
        'PIN serviceability at checkout',
        'Book shipments and return pickups, and print labels',
        'Tracking and failed delivery (NDR) follow-ups',
      ],
      helpTitle: 'Where is my API key?',
      helpBody:
        'Shadowfax emails it when your account is activated. Staging and production keys differ; use the production key.',
    },
  } as Record<string, { connects: string[]; helpTitle: string; helpBody: string }>,
} as const
