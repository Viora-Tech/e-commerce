/** Copy for the AI assistant (the AI bar on every page), its change cards and bulk "Write with AI". Plain words. */

export const assistantContent = {
  launcher: {
    placeholder: 'Ask AI, or tell it what to do…',
    open: 'Open AI assistant',
  },

  panel: {
    title: 'AI assistant',
    newChat: 'New chat',
    close: 'Close',
    on: (where: string) => `On ${where}`,
    greeting: 'What can I help with?',
    intro:
      'Ask about sales, stock and orders, or ask for a change. Nothing changes until you approve it.',
    placeholder: 'Ask, or say what to change…',
    send: 'Send',
    stop: 'Stop',
    disclaimer: 'AI can make mistakes. Check before you approve.',
    shortcut: 'to open or close',
    thinking: 'Checking your store…',
    checking: (what: string) => `Checking ${what}…`,
    preparing: 'Preparing the change…',
    stopped: 'Stopped.',
    failed: 'Sorry, that did not work. Please try again.',
    sources: (n: number) => (n === 1 ? 'Data used' : `Data used (${n})`),
    sourcesHide: 'Hide data',
    shared: (what: string) => `Shared with the AI: ${what}.`,
  },

  pages: {
    home: 'Home',
    products: 'Products',
    product: 'this product',
    collections: 'Collections',
    collection: 'this collection',
    orders: 'Orders',
    order: 'this order',
    discounts: 'Discounts',
    customers: 'Customers',
    customer: 'this customer',
    analytics: 'Analytics',
    settings: 'Settings',
    other: 'this page',
  } as Record<string, string>,

  chips: {
    home: [
      'Which products sold most this week?',
      'Why did conversion drop?',
      'Draft a Diwali offer',
      'Create discount DIWALI10: 10% off, 20 Oct to 5 Nov',
    ],
    products: [
      'Which products are running out?',
      'Raise all prices by 5%',
      'Top products this month?',
    ],
    product: [
      'Write this product in Hindi',
      'Improve the search title and description',
      'Suggest better tags',
    ],
    collections: ['Top products this month?', 'Which products are running out?'],
    collection: ['Raise prices 5% in this collection', 'Which products are running out?'],
    orders: [
      'Which orders are late?',
      'Abandoned checkouts this week?',
      'How were sales this week?',
    ],
    order: ['Draft a reply to this customer', 'Which orders are late?'],
    discounts: [
      'Create discount DIWALI10: 10% off, 20 Oct to 5 Nov',
      'Create code WELCOME5: 5% off everything',
    ],
    customers: ['How were sales this week?', 'Abandoned checkouts this week?'],
    customer: ['How were sales this week?'],
    analytics: ['How were sales this week?', 'Top products this month?'],
    settings: ['How were sales this week?'],
    other: ['How were sales this week?', 'Which orders are late?'],
  } as Record<string, string[]>,

  tools: {
    salesSummary: 'sales',
    topProducts: 'top products',
    lowStock: 'stock',
    pendingOrders: 'orders to ship',
    abandonedCheckouts: 'abandoned checkouts',
    findProducts: 'products',
    productDetails: 'the product',
    listCollections: 'collections',
    orderDetails: 'the order',
  } as Record<string, string>,

  card: {
    approve: 'Approve',
    edit: 'Edit',
    cancel: 'Cancel',
    save: 'Update preview',
    back: 'Back',
    undo: 'Undo',
    open: 'Open',
    now: 'Now',
    new: 'New',
    waiting: 'Waiting for your approval',
    status: {
      proposed: 'Needs approval',
      executed: 'Done',
      failed: 'Did not work',
      cancelled: 'Cancelled',
      expired: 'Expired',
      undone: 'Undone',
    } as Record<string, string>,
    flagged:
      'Before this, the AI read store text that looked like instructions to it. That text was ignored, but check this change carefully.',
    more: (n: number) => `and ${n} more`,
    count: (n: number) => (n === 1 ? '1 item' : `${n} items`),
    noUndo: 'This one cannot be undone.',
    willUndo: 'You can undo this afterwards.',
    reject: 'Reject',
    withdraw: 'Withdraw',
    waitingForOther: 'Waiting for a different member to approve it.',
    expired: 'This request expired, so nothing was changed. Ask again to make this change.',
    approved: 'Done',
    undone: 'Undone',
    failed: 'Could not do that. Nothing was changed.',
    fields: {
      code: 'Code',
      value: 'Amount',
      startsOn: 'Starts on',
      endsOn: 'Ends on',
      percent: 'Change (%)',
      title: 'Title',
      limit: 'Most products',
      description: 'Description',
      seoTitle: 'Search title',
      seoDescription: 'Search description',
      text: 'Text',
    } as Record<string, string>,
  },

  home: {
    title: 'Ask AI',
    subtitle: 'Answers from your own store data, and changes you approve first.',
    ask: 'Ask anything, or tell it what to do…',
    examplesAsk: 'Ask',
    examplesDo: 'Get it done',
    doChips: ['Create discount DIWALI10: 10% off, 20 Oct to 5 Nov', 'Raise all prices by 5%'],
  },

  bulk: {
    button: 'Write with AI',
    title: 'Write with AI',
    subtitle: (n: number) =>
      n === 1
        ? 'For 1 product. You review before anything is saved.'
        : `For ${n} products. You review before anything is saved.`,
    fieldsLabel: 'What to write',
    fields: {
      description: 'Description',
      seo: 'Search title and description',
      tags: 'Tags (added to yours)',
      altText: 'Photo alt text',
      keywords: 'Suggest search keywords (added to yours)',
    } as Record<string, string>,
    languageLabel: 'Language',
    toneLabel: 'Tone',
    start: 'Start writing',
    starting: 'Starting…',
    cost: (n: number, perProduct: number) =>
      n * perProduct === 1
        ? 'Uses 1 AI request.'
        : perProduct === 1
          ? `Uses ${n} AI requests, one per product.`
          : `Uses ${n * perProduct} AI requests, ${perProduct} per product (keywords, then the writing).`,
    progress: (done: number, total: number) => `${done} of ${total} written`,
    background: 'It keeps going if you leave this page. Come back to review.',
    optionsHeading: 'Settings for this run',
    backTo: { products: 'Products', seo: 'SEO', readiness: 'Catalog readiness' },
    cancelRun: 'Stop',
    reviewHeading: 'Review and apply',
    reviewHint: 'Untick any you do not want. Apply saves the ticked ones to your products.',
    apply: (n: number) => (n === 1 ? 'Apply to 1 product' : `Apply to ${n} products`),
    applied: (n: number) =>
      n === 1
        ? 'Applied to 1 product. Undo in Settings → AI.'
        : `Applied to ${n} products. Undo in Settings → AI.`,
    failedItem: 'Could not write this one',
    status: {
      pending: 'Waiting',
      running: 'Writing…',
      ready: 'Ready',
      failed: 'Failed',
      applied: 'Applied',
      skipped: 'Skipped',
    } as Record<string, string>,
    runStatus: {
      queued: 'Waiting to start',
      running: 'Writing',
      done: 'Finished',
      failed: 'Stopped',
      cancelled: 'Stopped',
    } as Record<string, string>,
    banner: (done: number, total: number) => `AI is writing ${done} of ${total} products`,
    bannerReady: (n: number) =>
      n === 1 ? '1 AI suggestion ready to review' : `${n} AI suggestions ready to review`,
    view: 'View',
    now: 'Now',
    suggested: 'Suggested',
    close: 'Close',
    failed: 'Could not start. Please try again.',
  },

  activity: {
    heading: 'Activity',
    help: 'Every change the AI made for your team, who approved it, and Undo where it can be undone.',
    empty: 'No AI changes yet. Ask the AI bar to do something, and approve it.',
    askedBy: (who: string) => `asked by ${who}`,
    approvedBy: (who: string) => `approved by ${who}`,
    cancelledBy: (who: string) => `cancelled by ${who}`,
    undo: 'Undo',
    review: 'Review',
    undone: 'Undone',
    more: 'Show more',
    failed: 'Could not load activity.',
    sources: {
      assistant: 'AI assistant',
      bulkWriter: 'Write with AI',
      mcp: 'AI client (MCP)',
    } as Record<string, string>,
  },
} as const
