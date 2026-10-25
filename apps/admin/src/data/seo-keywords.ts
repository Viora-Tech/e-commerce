/** Copy for a product's Search keywords card and its AI suggestions. Plain words. */
export const seoKeywordsContent = {
  heading: 'Search keywords',
  intro:
    'What shoppers in India type into Google to find this product. Write with AI builds the search title and description around them. They are never shown on your store.',
  suggest: 'Suggest keywords',
  suggestAgain: 'Suggest again',
  suggesting: 'Thinking of keywords…',
  needTitle: 'Add a product name first.',
  failed: 'Could not suggest keywords. Please try again.',
  empty: 'No keywords yet. Add your own, or let AI suggest some.',
  emptyNoAi: 'No keywords yet. Add the words shoppers would search for.',
  primary: 'Primary',
  primaryHint: 'The search title is built on the primary keyword.',
  makePrimary: 'Make primary',
  remove: (keyword: string) => `Remove ${keyword}`,
  addLabel: 'Add your own',
  addPlaceholder: 'e.g. wireless mouse for laptop',
  add: 'Add',
  full: (max: number) => `Up to ${max} keywords. Remove one to add another.`,
  suggestions: {
    heading: 'Suggested keywords',
    hint: 'Tick the ones that fit. The star is the AI pick for primary.',
    fromSearch: (n: number) =>
      n === 1
        ? 'Based on 1 real Google search that brought visitors to this product.'
        : `Based on ${n} real Google searches that brought visitors to this product.`,
    seen: 'Already searched',
    intents: { buy: 'Buy', compare: 'Compare', info: 'Info' },
    use: (n: number) => (n === 1 ? 'Use 1 keyword' : `Use ${n} keywords`),
    dismiss: 'Dismiss',
    added: 'Keywords added. Save the product to keep them.',
  },
  writer: {
    using: (keyword: string) => `Uses your primary keyword “${keyword}”`,
    missing: (keyword: string) => `Does not use your primary keyword “${keyword}”`,
    steering: (keyword: string) => `Search title and description are written around “${keyword}”.`,
    none: 'Tip: choose search keywords on the SEO tab and the search title and description are written around them.',
  },
} as const
