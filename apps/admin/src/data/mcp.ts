import { siteConfig } from '@commerce/config/site'
import type { ApiActivityFilter, ApiArea } from '@commerce/core/api-access'

const brand = siteConfig.brand.name

type GuideStep = { title: string; body: string }

/** Copy for Settings → MCP & API (Figma 704:110463) and the OAuth consent page. */
export const mcpContent = {
  title: 'MCP & API',
  subtitle: (store: string) =>
    `Let AI apps like Claude, Claude Code, ChatGPT and Cursor work with ${store}. They act as the person who connected them and never do more than that person's role allows.`,
  save: 'Save',
  saved: 'Saved',
  saveFailed: 'Could not save. Try again.',
  status: {
    connected: (n: number) => (n === 1 ? '1 AI app connected' : `${n} AI apps connected`),
    notConnected: 'Not connected yet',
    notConnectedBody: 'Pick your AI app below and follow the steps. It takes about 2 minutes.',
    live: 'Live',
    waiting: 'Waiting for an app',
    lastRequest: (ago: string) => `Last request ${ago}`,
    noRequests: 'No requests yet',
    url: 'MCP server URL',
    urlHelp:
      'Each address has its own connections. An app you connected to another address (say, your live admin) shows on that admin, not here.',
    signIn: 'Sign-in',
    signInValue: `${brand} sign-in (OAuth) or an API token`,
    limits: 'Limit',
    limitsValue: (n: number) => `${n} requests a minute per app`,
  },
  server: {
    url: 'Server URL',
    copy: 'Copy server URL',
    copied: 'Copied',
  },
  guide: {
    heading: 'Connect an AI app',
    help: 'Pick the app you use. Every app uses the same server URL and the same approval rules.',
    tabs: {
      claude: 'Claude',
      claudeCode: 'Claude Code',
      chatgpt: 'ChatGPT',
      cursor: 'Cursor',
      vscode: 'VS Code',
      other: 'Other MCP apps',
    },
    copyWhat: 'Command',
    copyJson: 'Config',
    copyHeader: 'Header',
    privateUrl:
      'This address only works on this computer, so web apps (claude.ai, ChatGPT) cannot reach it. Use Claude Code, Cursor or VS Code here, or connect web apps from your live admin.',
    claude: {
      steps: [
        { title: 'Copy the server URL', body: '' },
        {
          title: 'Add a custom connector in Claude',
          body: 'On claude.ai: Settings → Connectors → Add custom connector. Paste the URL and name it after your store. It also shows in Claude Desktop and the mobile app.',
        },
        {
          title: `Sign in with ${brand}`,
          body: 'Claude opens the sign-in page. Choose the areas Claude may use, then Allow.',
        },
      ] as GuideStep[],
      open: 'Open Claude connectors',
    },
    claudeCode: {
      steps: [
        {
          title: 'Add the server',
          body: 'Run this in your terminal. Add --scope user to use it in every project.',
        },
        {
          title: `Sign in with ${brand}`,
          body: 'Start Claude Code, type /mcp, pick the server and choose Authenticate. Your browser opens the sign-in page.',
        },
        {
          title: 'Try it',
          body: 'Ask "What sold yesterday?" Claude Code now shows the store tools.',
        },
      ] as GuideStep[],
    },
    chatgpt: {
      steps: [
        {
          title: 'Turn on developer mode',
          body: 'In ChatGPT: Settings → Apps & Connectors → Advanced settings → Developer mode. It is on paid ChatGPT plans.',
        },
        {
          title: 'Create a connector',
          body: 'Click Create, paste the server URL and pick OAuth for authentication.',
        },
        {
          title: `Sign in with ${brand}`,
          body: 'ChatGPT opens the sign-in page. ChatGPT also asks you to confirm each change before it sends it.',
        },
      ] as GuideStep[],
      supported:
        'Supported: the server speaks Streamable HTTP with OAuth sign-in, which ChatGPT developer mode needs.',
      open: 'Open ChatGPT settings',
    },
    cursor: {
      steps: [
        {
          title: 'Add the server',
          body: 'Click Add to Cursor, or paste this into ~/.cursor/mcp.json.',
        },
        {
          title: `Sign in with ${brand}`,
          body: 'In Cursor Settings → MCP the server shows "Needs login". Click it and sign in.',
        },
      ] as GuideStep[],
      open: 'Add to Cursor',
    },
    vscode: {
      steps: [
        {
          title: 'Add the server',
          body: 'Click Add to VS Code, or paste this into .vscode/mcp.json in your project.',
        },
        {
          title: `Sign in with ${brand}`,
          body: 'VS Code asks to sign in the first time Copilot agent mode uses the server.',
        },
      ] as GuideStep[],
      open: 'Add to VS Code',
    },
    other: {
      steps: [
        {
          title: 'Add the server URL',
          body: 'Transport: Streamable HTTP. Most apps take a config like this one.',
        },
        {
          title: 'Apps that only run local servers',
          body: 'Use mcp-remote, which needs Node.js, to bridge to the server.',
        },
        {
          title: `Sign in with ${brand}`,
          body: 'Apps that support MCP sign-in open the page on their own. Others can send an API token (below).',
        },
      ] as GuideStep[],
    },
    capabilities: {
      heading: 'What AI apps can do',
      tools: [
        {
          title: 'Quick reads',
          body: 'findProducts, orderDetails, salesSummary, lowStock and more answer straight away.',
        },
        {
          title: 'Proposals',
          body: 'proposeProductUpdate, proposeDiscount, proposeCollection and others draft a change for you to approve.',
        },
        {
          title: 'Every admin action',
          body: 'searchActions finds it, describeAction shows its inputs and whether it waits, runAction runs it.',
        },
      ] as GuideStep[],
      rules: [
        { title: 'Reads', body: 'Run right away.' },
        { title: 'Changes', body: 'Follow "Changes need approval" below.' },
        {
          title: 'Sensitive',
          body: 'Refunds, cancellations, deletes, and payment, staff, billing and domain settings always wait for approval.',
        },
        {
          title: 'Never',
          body: 'Sign in as you, create or revoke tokens, or approve their own changes.',
        },
      ] as GuideStep[],
      reconnect:
        'Connected an app before this update? Reconnect it, or restart it, so it loads every action.',
    },
    token: {
      heading: 'Use an API token instead',
      body: 'For apps that cannot open a sign-in page. Create a token, then send it with every request in this header. Token changes run at once, without approval.',
      withToken: 'With a token',
      placeholder: 'YOUR_API_TOKEN',
      create: 'Create API token',
    },
  },
  connected: {
    heading: 'Connected AI apps',
    help: 'Every app that signed in, and every API token that has been used. Disconnect anything you do not recognise.',
    app: 'App',
    connectedBy: 'Connected by',
    canDo: 'Can do',
    lastUsed: 'Last used',
    viaOAuth: 'Signed in with OAuth',
    viaToken: (hint: string) => `API token · ${hint}`,
    lapsed: 'Sign-in lapsed, reconnect in the app',
    tokenRuns: 'changes run at once',
    disconnect: 'Disconnect',
    emptyTitle: 'No AI apps connected',
    emptyBody: 'Connect one with the guide above. It shows here as soon as it signs in.',
  },
  permissions: {
    heading: 'Permissions & approvals',
    help: 'These apply to every app that signs in. API tokens follow their own areas.',
    rules: {
      reads: 'Reads run right away.',
      changesOff: 'Changes are off, so apps can only read.',
      changesApproval: 'Changes wait in AI approvals until someone approves them.',
      changesDirect: 'Changes run as soon as the app asks.',
      sensitive:
        'Sensitive actions always wait for approval: refunds, cancellations, deletes, and payment, staff, billing and domain settings.',
      customersOn: 'Apps can read customer names, phone numbers and addresses.',
      customersOff: 'Customer names, phone numbers and addresses stay hidden.',
    },
  },
  switches: {
    allowChanges: 'Allow AI apps to make changes',
    allowChangesHelp:
      'When off, apps can only read. Turn on to let them use any admin action your role allows, from products and orders to themes and settings.',
    requireApproval: `Changes need approval in ${brand}`,
    requireApprovalHelp:
      'Every change waits in AI approvals until you or a staff member approves it. Recommended. Refunds, cancellations, deletes, and payment, staff, billing and domain settings always wait, even when this is off.',
    readCustomers: 'Let apps read customer details',
    readCustomersHelp:
      'Names, phone numbers and addresses. Off by default; orders still show the city.',
  },
  table: {
    memberLine: (role: string, date: string) => `${role} · ${date}`,
    removedMember: 'No longer on the team',
    never: 'Not yet',
    from: (ip: string) => `From ${ip}`,
    stopped: 'Stopped working',
    revoke: 'Revoke',
    tokensHeading: 'API tokens',
    tokensHelp:
      'For scripts, servers and AI apps that cannot sign in. People should sign in instead, so their own staff permissions apply.',
    createToken: 'Create token',
    name: 'Name',
    scopes: 'Scopes',
    expires: 'Expires',
    expiresNever: 'Never',
    expired: (date: string) => `Expired ${date}`,
    lastUsed: 'Last used',
    noTokens: 'No API tokens yet',
    noTokensBody: 'Create one for a script or server that needs to read or update your store.',
  },
  canDo: {
    readAll: 'Read everything',
    read: (areas: string) => `Read ${areas}`,
    readWrite: 'Read & write',
    readOnly: 'Read only',
    propose: (areas: string) => `Run ${areas} actions`,
    needsApproval: 'needs approval',
    sensitiveApproval: 'sensitive ones need approval',
  },
  areas: {
    products: 'Products',
    orders: 'Orders',
    customers: 'Customers',
    inventory: 'Inventory',
    discounts: 'Discounts',
    content: 'Content',
    analytics: 'Analytics',
    marketing: 'Marketing',
    online_store: 'Online store',
    settings: 'Settings',
  } satisfies Record<ApiArea, string>,
  access: { read: 'Read', write: 'Write' },
  create: {
    title: 'Create API token',
    intro: 'For a script, server or AI app. Give it only what it needs.',
    name: 'Name',
    namePlaceholder: 'Inventory sync script',
    canAccess: 'Can access',
    expires: 'Expires',
    expiry: { 30: 'In 30 days', 90: 'In 90 days', 365: 'In 1 year', never: 'Never' },
    note: 'Tokens act at once and cannot run sensitive settings actions. Apps that sign in follow "Changes need approval", and their sensitive actions always wait.',
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
    label: 'API token',
    copy: 'Copy token',
    copied: 'Copied',
    name: 'Name',
    canAccess: 'Can access',
    expires: 'Expires',
    use: 'Send it with every request as',
    claudeCode: 'Or add it to Claude Code',
    done: 'Done',
  },
  revoke: {
    title: (name: string) => `Revoke ${name}?`,
    disconnectTitle: (name: string) => `Disconnect ${name}?`,
    client: (name: string, store: string, member: string) =>
      `${name} loses access to ${store} right away. ${member} can connect it again later. Changes already waiting in AI approvals stay there.`,
    token: (name: string) =>
      `Anything using "${name}" stops working right away. This cannot be undone; create a new token if you need one.`,
    keep: 'Keep',
    confirm: 'Revoke',
    disconnect: 'Disconnect',
    done: (name: string) => `${name} disconnected`,
    failed: 'Could not disconnect. Try again.',
  },
  activity: {
    heading: 'Activity',
    help: 'Everything apps and tokens read or changed in the last 90 days. Changes link to their approval.',
    open: 'View activity',
    title: 'MCP activity',
    subtitle: (store: string) =>
      `Everything AI apps and tokens did in ${store} in the last 90 days. Changes link to their approval.`,
    back: 'MCP & API',
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
    emptyBody: 'When an app or token reads or changes something, it shows up here.',
    loadFailed: 'Could not load activity. Try again.',
  },
  consent: {
    title: (client: string, store: string) => `Allow ${client} to use ${store}?`,
    intro: (client: string, member: string) =>
      `${client} will act as you (${member}) and never do more than your role allows.`,
    signedInAs: (email: string) => `Signed in as ${email}`,
    canAccess: (client: string) => `What ${client} can do`,
    approvalNote: `Refunds, cancellations, deletes, and payment, staff and billing settings always wait for approval in ${brand}. Other changes do too, unless your store turned approval off.`,
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
