import { definePlugin } from '@commerce/plugins'

export const SEARCH_ID = 'search'

/**
 * Search & discovery: Shopify's app of the same name, on our own search. Every store's search
 * already forgives typos ("keybord") in @commerce/core; this app adds the merchant's controls,
 * starting with synonyms. No search server to run (Meilisearch stays an optional connection
 * for very large catalogues; see docs/open-source-radar.md).
 */
export const searchPlugin = definePlugin({
  id: SEARCH_ID,
  name: 'Search & discovery',
  version: '1.0.0',
  kind: 'builtin',
  category: 'search',
  description:
    'Tune your store’s search: words that mean the same thing, so shoppers find what they mean.',
  listing: {
    tagline: 'Words that mean the same thing, so shoppers find what they mean.',
    highlights: [
      'Synonyms for your store search',
      'Works with the built-in search and Meilisearch',
    ],
    worksWith: ['The Meilisearch app'],
    keywords: ['search', 'synonyms'],
    faq: [
      {
        question: 'Do I need Meilisearch for this?',
        answer:
          'No. Synonyms work with the built-in store search, and with Meilisearch if you add it.',
      },
    ],
  },
  access: {
    resources: [
      { resource: 'products', level: 'read', why: 'Matches searches against your products' },
    ],
    summary: 'reads products',
  },
  provides: {},
  admin: {
    icon: 'Search',
    pages: [{ path: '', title: 'Synonyms', navLabel: 'Synonyms', icon: 'Search' }],
  },
})
