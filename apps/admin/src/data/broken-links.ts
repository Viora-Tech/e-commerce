export type BrokenLinkListItem = {
  id: string
  path: string
  hits: number
  lastSeen: string | Date
  referrer: string | null
  suggestion: { target: string; score: number } | null
}

/** Content › Menus › URL redirects › Broken links: storefront paths that answered 404. */
export const brokenLinksContent = {
  views: {
    label: 'Redirects view',
    redirects: 'Redirects',
    broken: 'Broken links',
  },
  summary: (n: number) =>
    n === 0
      ? 'No broken links yet. Pages that answer "not found" show here.'
      : `${n} ${n === 1 ? 'old address' : 'old addresses'} answered "not found"`,
  resource: { singular: 'broken link', plural: 'broken links' },
  loadFailed: 'Could not load broken links',
  columns: {
    path: 'Broken path',
    hits: 'Visits',
    lastSeen: 'Last seen',
    suggestion: 'Suggested redirect',
  },
  from: (referrer: string) => `From ${referrer}`,
  noSuggestion: 'No close match',
  create: 'Create redirect',
  created: 'Redirect created',
  createFailed: 'Could not create the redirect',
  choose: 'Choose target',
  dismiss: 'Dismiss',
  dismissSelected: (n: number) => `Dismiss ${n}`,
  dismissed: (n: number) => `${n} ${n === 1 ? 'link' : 'links'} dismissed`,
  dismissFailed: 'Could not dismiss',
  actionsLabel: 'Broken link actions',
  empty: {
    heading: 'No broken links',
    body: 'When a shopper or search engine opens an address that does not exist, it shows here with the closest product or collection, so you can redirect it in one click.',
    searchHeading: 'No broken links match',
  },
} as const
