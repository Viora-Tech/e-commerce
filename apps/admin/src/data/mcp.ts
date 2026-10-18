import { siteConfig } from '@commerce/config/site'
import type { ApiActivityFilter, ApiArea, McpClientId } from '@commerce/core/api-access'

const brand = siteConfig.brand.name

/** Copy for Settings → MCP & API (Figma 704:110463) and the OAuth consent page. */
export const mcpContent = {
  title: 'MCP & API',
  tabs: { overview: 'Overview', clients: 'Clients & tokens', activity: 'Activity log' },
  subtitles: {
    overview: (store: string) =>
      `Let AI tools like Claude, ChatGPT and Cursor work with ${store}. They sign in with your ${brand} account, and every change they make waits for your approval.`,
    clients: (store: string) =>
      `Who can reach ${store} through MCP or the API, and what they are allowed to do. Revoke anything you do not recognise.`,
    activity: (store: string) =>
      `Everything AI clients and tokens did in ${store} in the last 90 days. Changes link to their approval.`,
  },
  save: 'Save',
  saved: 'Saved',
  saveFailed: 'Could not save. Try again.',
  server: {
    heading: 'MCP server',
    help: (store: string) =>
      `Give an AI tool this address. It signs in with a ${brand} account and only ever sees ${store}.`,
    url: 'Server URL',
    copy: 'Copy server URL',
    copied: 'Copied',
    status: 'Status',
    lastRequest: (ago: string) => `Last request ${ago}`,
    noRequests: 'No requests yet',
    online: (n: number) => (n === 1 ? 'Online · 1 client' : `Online · ${n} clients`),
    waiting: 'Waiting for a client',
    signIn: 'Sign-in',
    signInHelp: `Clients open a ${brand} sign-in page; no passwords are shared`,
    signInValue: 'OAuth',
    limits: 'Limits',
    limitsHelp: 'Per client, so one tool cannot slow your store',
    limitsValue: (n: number) => `${n} requests / min`,
  },
  connect: {
    heading: 'Connect a client',
    help: 'Pick your tool to see a 3-step guide.',
    connected: 'Connected',
    connect: 'Connect',
  },
  clients: {
    claude: {
      name: 'Claude',
      by: 'by Anthropic',
      blurb: 'Ask about your store and draft changes from Claude.',
      steps: [
        { title: 'Copy the server URL', body: '' },
        {
          title: 'In Claude, add a custom connector',
          body: 'Settings → Connectors → Add custom connector. Paste the URL and give it a name, like your store’s.',
        },
        {
          title: `Sign in with ${brand}`,
          body: 'Choose what Claude can do. Changes still wait for approval here.',
        },
      ],
      open: 'Open Claude',
    },
    chatgpt: {
      name: 'ChatGPT',
      by: 'by OpenAI',
      blurb: 'Use your store’s data inside ChatGPT conversations.',
      steps: [
        { title: 'Copy the server URL', body: '' },
        {
          title: 'In ChatGPT, create a connector',
          body: 'Settings → Apps & Connectors → Advanced settings → Developer mode, then Create. Paste the URL.',
        },
        {
          title: `Sign in with ${brand}`,
          body: 'Choose what ChatGPT can do. Changes still wait for approval here.',
        },
      ],
      open: 'Open ChatGPT',
    },
    cursor: {
      name: 'Cursor',
      by: 'by Anysphere',
      blurb: 'Build store tools and theme code with live data.',
      steps: [
        { title: 'Copy the server URL', body: '' },
        {
          title: 'Add it to Cursor',
          body: 'Click "Add to Cursor" below, or Cursor Settings → MCP → Add new MCP server and paste the URL.',
        },
        {
          title: `Sign in with ${brand}`,
          body: 'Cursor opens the sign-in page the first time it uses the server.',
        },
      ],
      open: 'Add to Cursor',
    },
    vscode: {
      name: 'VS Code',
      by: 'by Microsoft',
      blurb: 'Use Copilot agent mode with your store.',
      steps: [
        { title: 'Copy the server URL', body: '' },
        {
          title: 'Add it to VS Code',
          body: 'Click "Add to VS Code" below, or run "MCP: Add Server" → HTTP and paste the URL.',
        },
        {
          title: `Sign in with ${brand}`,
          body: 'VS Code asks to sign in the first time Copilot uses the server.',
        },
      ],
      open: 'Add to VS Code',
    },
  } satisfies Record<
    McpClientId,
    {
      name: string
      by: string
      blurb: string
      steps: { title: string; body: string }[]
      open: string
    }
  >,
  guide: {
    title: (client: string) => `Connect ${client}`,
    intro: (client: string) =>
      `About 2 minutes. ${client} signs in with your ${brand} account, so your staff permissions apply.`,
    others: 'ChatGPT, Cursor, Claude and VS Code use the same URL. Each has its own guide.',
    close: 'Close',
  },
  switches: {
    heading: 'What AI clients can do',
    allowChanges: 'Allow AI clients to make changes',
    allowChangesHelp:
      'When off, clients can only read. Turn on to let them propose edits to products, discounts and content.',
    requireApproval: `Changes need approval in ${brand}`,
    requireApprovalHelp:
      'Every change waits in AI approvals until you or a staff member approves it. Recommended.',
    readCustomers: 'Let clients read customer details',
    readCustomersHelp:
      'Names, phone numbers and addresses. Off by default; orders still show the city.',
  },
  table: {
    clientsHeading: 'Connected clients',
    client: 'Client',
    connectedBy: 'Connected by',
    canDo: 'Can do',
    lastUsed: 'Last used',
    viaOAuth: 'MCP · OAuth',
    memberLine: (role: string, date: string) => `${role} · ${date}`,
    removedMember: 'No longer on the team',
    never: 'Not yet',
    from: (ip: string) => `From ${ip}`,
    stopped: 'Stopped working',
    actions: (name: string) => `Actions for ${name}`,
    revoke: 'Revoke',
    tokensHeading: 'Access tokens',
    createToken: 'Create token',
    name: 'Name',
    scopes: 'Scopes',
    expires: 'Expires',
    expiresNever: 'Never',
    expired: (date: string) => `Expired ${date}`,
    tokensNote:
      'Tokens are for scripts and servers. People should connect a client instead, so their own staff permissions apply.',
    noTokens: 'No access tokens yet',
    noTokensBody: 'Create one for a script or server that needs to read or update your store.',
  },
  canDo: {
    readAll: 'Read everything',
    read: (areas: string) => `Read ${areas}`,
    readWrite: 'Read & write',
    readOnly: 'Read only',
    propose: (areas: string) => `Propose ${areas} changes`,
    needsApproval: 'needs approval',
  },
  areas: {
    products: 'Products',
    orders: 'Orders',
    customers: 'Customers',
    inventory: 'Inventory',
    discounts: 'Discounts',
    content: 'Content',
    analytics: 'Analytics',
  } satisfies Record<ApiArea, string>,
  access: { read: 'Read', write: 'Write' },
  empty: {
    title: 'No clients connected',
    body: (store: string) =>
      `Connect Claude, ChatGPT, Cursor or VS Code to work with ${store} from your AI tool.`,
    action: 'Connect a client',
  },
  create: {
    title: 'Create access token',
    intro: 'For a script or server. Give it only what it needs.',
    name: 'Name',
    namePlaceholder: 'Inventory sync script',
    canAccess: 'Can access',
    expires: 'Expires',
    expiry: { 30: 'In 30 days', 90: 'In 90 days', 365: 'In 1 year', never: 'Never' },
    note: 'Write access still follows "Changes need approval" for AI clients; tokens act at once.',
    cancel: 'Cancel',
    create: 'Create token',
    creating: 'Creating…',
    pickArea: 'Pick at least one area.',
    failed: 'Could not create the token. Try again.',
  },
  shown: {
    title: 'Copy your token now',
    intro: 'You won’t see this again. Keep it in your server’s secret settings, never in code.',
    once: 'Shown once',
    label: 'Access token',
    copy: 'Copy token',
    copied: 'Copied',
    name: 'Name',
    canAccess: 'Can access',
    expires: 'Expires',
    done: 'Done',
  },
  revoke: {
    title: (name: string) => `Revoke ${name}?`,
    client: (name: string, store: string, member: string) =>
      `${name} loses access to ${store} right away. ${member} can connect it again later. Changes already waiting in AI approvals stay there.`,
    token: (name: string) =>
      `Anything using "${name}" stops working right away. This cannot be undone; create a new token if you need one.`,
    keep: 'Keep',
    confirm: 'Revoke',
    done: (name: string) => `${name} revoked`,
    failed: 'Could not revoke. Try again.',
  },
  activity: {
    heading: 'Activity',
    export: 'Export CSV',
    exportFailed: 'Could not export. Try again.',
    filters: {
      all: 'All',
      read: 'Reads',
      change: 'Changes',
      approval: 'Waiting approval',
      blocked: 'Blocked',
    } satisfies Record<ApiActivityFilter, string>,
    today: 'Today',
    yesterday: 'Yesterday',
    openApproval: 'Open approval',
    loadOlder: 'Load older activity',
    loading: 'Loading…',
    empty: 'Nothing yet',
    emptyBody: 'When a client or token reads or changes something, it shows up here.',
    loadFailed: 'Could not load activity. Try again.',
  },
  consent: {
    title: (client: string, store: string) => `Allow ${client} to use ${store}?`,
    intro: (client: string, member: string) =>
      `${client} will act as you (${member}) and never do more than your role allows.`,
    signedInAs: (email: string) => `Signed in as ${email}`,
    canAccess: (client: string) => `What ${client} can do`,
    approvalNote: `Changes still wait in ${brand} for approval unless your store turned approval off.`,
    allow: 'Allow',
    deny: 'Deny',
    working: 'One moment…',
    failed: 'Something went wrong. Start the connection again from your AI tool.',
    pickArea: 'Pick at least one area.',
    invalid: 'This sign-in link is not valid',
    invalidBody: 'Start the connection again from your AI tool.',
    noStore: 'You are not a member of this store',
    noStoreBody:
      'Sign in with an account that belongs to the store, or ask its owner for an invite.',
    returning: (client: string) => `Returning to ${client}…`,
  },
}
