/** Copy for Online store › SEO › Search opportunities: the pages Google shows, and Fix with AI. */
export const seoAssistantContent = {
  title: 'SEO',
  subtitle:
    'Your products, collections and pages on Google: what people search, where you rank, and what to rewrite first.',
  loadFailed: 'Could not load search opportunities',
  tabs: { report: 'Report', assistant: 'Search opportunities' },
  states: {
    notInstalledTitle: 'Connect Google Search Console',
    notInstalled:
      'Search opportunities read your real Google numbers. Install the free Google Search Console app and connect your Google account.',
    install: 'Install the app',
    notConnectedTitle: 'Finish connecting Google Search Console',
    notConnected: 'Sign in with Google and pick your store’s property on the app’s Settings.',
    openSettings: 'Open Search Console settings',
    noDataTitle: 'No Google numbers yet',
    noData:
      'Google has not reported any searches for your store yet. A new property can take a few days. The numbers update once a day.',
  },
  list: {
    heading: 'Pages to improve',
    body: 'Biggest chance first: pages Google shows often at position 4 to 15, where a sharper search title and description win the most clicks.',
    synced: (when: string) => `Google numbers from ${when}. They update once a day.`,
    filters: { all: 'All', band: 'Position 4–15', gaps: 'With gaps' },
    resource: { product: 'Product', collection: 'Collection', page: 'Page' },
    impressions: 'Views',
    clicks: 'Clicks',
    position: 'Position',
    topSearches: 'Top searches',
    noSearches: 'No single search stands out yet.',
    current: 'On Google now',
    noSeoTitle: 'No search title: Google shows the item’s own title.',
    noSeoDescription: 'No search description: Google picks text from the page.',
    gaps: 'Gaps',
    noGaps: 'No gaps found.',
    moreGaps: (n: number) => `+${n} more`,
    fix: 'Fix with AI',
    fixSelected: (n: number) => `Fix ${n} with AI`,
    select: (title: string) => `Select ${title}`,
    selectMax: (n: number) => `Up to ${n} at a time.`,
    edit: 'Edit',
    empty: 'Nothing matches this filter.',
    more: (n: number) => `Show ${n} more`,
    aiOff: 'Turn on Write with AI in Settings → AI to fix these with AI.',
  },
  fix: {
    title: (n: number) => (n === 1 ? 'Fix with AI' : `Fix ${n} items with AI`),
    description:
      'New search titles and descriptions built on the searches people really make. Nothing is saved until you press Apply.',
    working: 'Writing…',
    failed: 'The AI could not write these this time. Please try again.',
    itemFailed: 'Could not write this one. Try it again on its own.',
    notFound: 'This item is no longer live.',
    before: 'Now',
    after: 'Suggested',
    seoTitle: 'Search title',
    seoDescription: 'Search description',
    chars: (n: number, max: number) => `${n} / ${max} characters`,
    empty: '(none)',
    snippet: 'Intro or FAQ to add to the page',
    snippetHint: (words: number) =>
      `${words} words. Not saved by Apply: copy it into the description or page text if you like it.`,
    copy: 'Copy',
    copied: 'Copied',
    include: 'Apply this one',
    fromSearches: (n: number) =>
      n === 0
        ? 'No search data: written from the item’s own text.'
        : `Built on ${n} real searches.`,
    apply: (n: number) => (n === 1 ? 'Apply' : `Apply ${n}`),
    applied: (n: number) => (n === 1 ? 'Search listing updated' : `${n} search listings updated`),
    applyFailed: 'Could not save the changes. Please try again.',
  },
}
