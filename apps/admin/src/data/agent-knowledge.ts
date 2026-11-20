/** Copy for Sales channels → Agentic sales → Knowledge base. */
import type { KnowledgeGroup, KnowledgeKey } from '@commerce/core/agent-knowledge'

export const agentKnowledgeContent = {
  title: 'Knowledge base',
  subtitle:
    'What AI tells shoppers about your store, in your store chat and in AI assistants. Only published items are used.',
  /** One Knowledge base in two tabs (`components/sales-channels/knowledge-tabs.tsx`). */
  tabs: { label: 'Knowledge base', facts: 'Store facts', answers: 'Questions & answers' },
  back: 'Agentic sales',
  scan: 'Scan my store',
  rescan: 'Rescan',
  scanning: 'Reading your store…',
  scanned: 'New facts are ready to review',
  scanFailed: 'The scan could not finish. Please try again.',
  saved: 'Saved',
  saveFailed: 'Could not save. Please try again.',
  emptyHeading: 'No facts yet',
  emptyBody:
    'Scan your store and AI drafts facts from your description, About page, policies and products. You check each one before agents see it.',
  groups: {
    about: 'About',
    brands: 'Brands and products',
    shopping: 'Shopping',
    faq: 'Questions shoppers ask',
  } satisfies Record<KnowledgeGroup, string>,
  facts: {
    description: 'Description',
    audience: 'Who it is for',
    founded: 'Year founded',
    location: 'Based in',
    brands: 'Key brands',
    categories: 'What you sell',
    values: 'Brand values',
    style: 'Style and look',
    shipping: 'Shipping',
    payments: 'Payment options',
    returns: 'Returns',
    support: 'Customer support',
    faq: 'FAQ',
  } satisfies Record<KnowledgeKey, string>,
  groupCount: (published: number, total: number) => `${published} of ${total} published`,
  publishAll: 'Publish all',
  published: 'Published',
  unpublished: 'Unpublished',
  publish: 'Publish',
  unpublish: 'Unpublish',
  edit: 'Edit',
  add: 'Add',
  save: 'Save',
  cancel: 'Cancel',
  draftByAi: 'Drafted by AI',
  tagsHint: 'One per line',
  question: 'Question',
  answer: 'Answer',
  addQuestion: 'Add a question',
  remove: 'Remove',
  status: 'Status',
  publishedFacts: 'Published facts',
  publishedOf: (published: number, total: number) => `${published} of ${total}`,
  policies: 'Policies',
  policyHidden: 'Not published',
  lastScanned: 'Last scanned',
  neverScanned: 'Not scanned yet',
  scanNote:
    'A scan only rewrites unpublished AI drafts. Facts you published or wrote stay as they are.',
  whereHeading: 'Where agents read this',
  where: [
    'Your store’s llms.txt, which AI assistants read',
    'Your store’s agent endpoint (/api/mcp), when an agent answers a shopper',
  ],
} as const

/** The Knowledge base step, sources rows and "Test a query" on the Agentic sales page. */
export const agentReadyContent = {
  button: 'Knowledge base',
  step: {
    title: 'Publish your knowledge base',
    body: (published: number, total: number) =>
      total === 0
        ? 'Scan your store so agents can answer questions about shipping, returns and your brand.'
        : `${published} of ${total} facts published.`,
  },
  sources: {
    knowledge: 'Knowledge base',
    knowledgeCount: (published: number, total: number) => `${published} of ${total} published`,
    endpoint: 'Agent endpoint',
    endpointValue: '/api/mcp',
  },
  /** The overview's right column before any agent is live: what works today, what is coming. */
  status: {
    liveHeading: 'Live today',
    live: [
      'AI assistants can read your store: products, prices, stock and policies.',
      'They answer from your store through llms.txt and the agent endpoint.',
    ],
    comingHeading: 'Coming',
    coming: 'Coming',
    comingBody:
      'Checkout inside ChatGPT, Google AI Mode, Perplexity and Copilot opens in India later. You don’t need to apply: your store is listed when each one opens here.',
  },
  test: {
    heading: 'Search the way an agent does',
    placeholder: 'Try “wireless mouse under 5000”',
    label: 'Test a query',
    run: 'Search',
    empty: (q: string) => `No products agents can see match “${q}”.`,
    failed: 'The search could not run. Please try again.',
    soldOut: 'Sold out',
    note: 'These are the products an AI agent gets from your store for this search, in this order.',
  },
} as const
