import { definePlugin } from '@commerce/plugins'

export const SEARCH_ID = 'search'

/**
 * Search & discovery: Shopify's app of the same name, on our own search. Every store's search
 * already forgives typos ("keybord") in @commerce/core; this app adds the merchant's controls,
 * synonyms and the storefront filters (which groups collection and search pages show), what
 * shoppers search and click (the Overview, @commerce/core `discovery/`), search boosts and pins,
 * and hand-picked related and complementary products. No search server to run (Meilisearch stays an optional connection
 * for very large catalogues; see docs/open-source-radar.md).
 */
export const searchPlugin = definePlugin({
  id: SEARCH_ID,
  name: 'Search & discovery',
  version: '1.0.0',
  kind: 'builtin',
  category: 'search',
  description:
    'Tune your store’s search and filters: see what shoppers search for, pin and boost products, pick recommendations, add words that mean the same thing, and choose the filters on collection and search pages.',
  listing: {
    tagline: 'Words that mean the same thing, so shoppers find what they mean.',
    highlights: [
      'See top searches, searches with no results and the search funnel',
      'Pin products to a search, boost or bury by tag, type or vendor',
      'Pick related and complementary products for each product',
      'Synonyms for your store search',
      'Choose the filters on collection and search pages, from options, product fields or tags',
      'Works with the built-in search and Meilisearch',
    ],
    worksWith: ['The Meilisearch app'],
    keywords: ['search', 'synonyms', 'filters', 'boosts', 'recommendations', 'search analytics'],
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
      {
        resource: 'products',
        level: 'write',
        why: 'Matches searches against your products and saves the recommendations you pick',
      },
    ],
    summary: 'reads products, saves picked recommendations',
  },
  provides: {},
  admin: {
    icon: 'Search',
    pages: [
      { path: '', title: 'Overview', navLabel: 'Overview', icon: 'BarChart3' },
      { path: 'synonyms', title: 'Synonyms', navLabel: 'Synonyms', icon: 'Search' },
      { path: 'filters', title: 'Filters', navLabel: 'Filters', icon: 'Filter' },
      { path: 'boosts', title: 'Boosts', navLabel: 'Boosts', icon: 'TrendingUp' },
      {
        path: 'recommendations',
        title: 'Recommendations',
        navLabel: 'Recommendations',
        icon: 'Blocks',
      },
      { path: 'recommendations/[productId]', title: 'Product recommendations' },
    ],
  },
})
