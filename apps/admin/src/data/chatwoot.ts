/** Copy for the Chatwoot app's page and its Conversations cards. Plain words. */
export const chatwootContent = {
  title: 'Chatwoot',
  subtitle: 'Live chat on your store, and one inbox for every message your shoppers send.',
  save: 'Save',
  discard: 'Discard',
  unsaved: 'Unsaved changes',
  saved: 'Saved',
  failed: 'Could not save. Try again.',
  open: 'Open Chatwoot',
  status: {
    live: 'Chat is live on your store.',
    identifying: 'Signed-in shoppers are recognised, with their orders beside the chat.',
    api: 'Customers are kept as Chatwoot contacts, and their chats show on customer and order pages.',
    notSetUp: 'Not set up yet. Add your Chatwoot address and website inbox below.',
  },
  connect: {
    title: 'Connect Chatwoot',
    description:
      'Chatwoot is an open-source support inbox: website chat, WhatsApp, email and more in one place. Use Chatwoot Cloud or your own Chatwoot server.',
    baseUrl: {
      label: 'Chatwoot address',
      help: 'Where your Chatwoot opens, for example https://support.yourstore.in. Using Chatwoot Cloud? Type app.chatwoot.com.',
      placeholder: 'https://app.chatwoot.com',
    },
    accountId: {
      label: 'Account id',
      help: 'The number after /app/accounts/ in your Chatwoot address bar. Pasting a full dashboard link above fills it in.',
      placeholder: '1',
    },
    websiteToken: {
      label: 'Website inbox token',
      help: 'In Chatwoot: Settings → Inboxes → your website inbox → Configuration. Copy the websiteToken from the script. No website inbox yet? Add one there first.',
      placeholder: 'Paste the website token',
    },
    apiToken: {
      label: 'API access token',
      help: 'Lets us keep contacts in sync and show conversations here. In Chatwoot: your profile → Profile settings → Access token.',
      placeholder: 'Paste the token',
      saved: 'A token is saved. Paste a new one to replace it.',
      remove: 'Remove token',
      removed: 'Token removed',
    },
    hmacToken: {
      label: 'Identity secret (HMAC)',
      help: 'Proves a signed-in shopper is who they say. In Chatwoot: your website inbox → Configuration → Identity validation. Turn on “Enforce user identity validation” there too.',
      placeholder: 'Paste the secret',
      saved: 'A secret is saved. Paste a new one to replace it.',
      remove: 'Remove secret',
      removed: 'Secret removed',
    },
    check: {
      label: 'Check the connection',
      help: 'Checks the token opens the account and the website token belongs to it. Creates nothing in Chatwoot.',
    },
    test: 'Test connection',
    testOk: (agent: string, inbox: string | null) =>
      inbox ? `Connected as ${agent}. Website inbox: ${inbox}` : `Connected as ${agent}`,
    testNeeds: 'Add the address, account id and API access token first.',
  },
  shoppers: {
    title: 'Shoppers',
    identify: {
      label: 'Recognise signed-in shoppers',
      help: 'Their name, email, phone, customer since, orders, total spent and last order show beside the chat. Needs the identity secret.',
    },
    sync: {
      label: 'Keep customers as Chatwoot contacts',
      help: 'When a customer signs up, changes their details or pays, their contact in Chatwoot is created or updated. Needs the API access token.',
    },
  },
  privacy: {
    title: 'Privacy',
    label: 'Load the chat',
    help: 'Chatwoot keeps a cookie so a shopper’s chat carries on across pages. Pick when it loads.',
    options: {
      necessary: 'Always (a chat shoppers ask for)',
      analytics: 'After the shopper allows analytics cookies',
      marketing: 'After the shopper allows marketing cookies',
    },
  },
  credit: 'Chatwoot is open source (MIT licence), made by Chatwoot Inc.',
  card: {
    title: 'Conversations',
    open: 'Open in Chatwoot',
    contact: 'Contact in Chatwoot',
    empty: 'No conversations with this customer yet.',
    noContact: 'This customer has not chatted with you yet.',
    notConnected: 'Add an API access token in the Chatwoot app to see conversations here.',
    settings: 'Chatwoot settings',
    error: 'Could not load conversations.',
    unread: (n: number) => (n === 1 ? '1 unread' : `${n} unread`),
    noPreview: 'No messages yet',
    statuses: {
      open: 'Open',
      pending: 'Pending',
      snoozed: 'Snoozed',
      resolved: 'Resolved',
    },
  },
} as const
