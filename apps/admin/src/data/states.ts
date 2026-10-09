/** Copy for the shared page and inline states (`components/states`). */
export const statesContent = {
  loading: 'Loading',
  error: {
    heading: 'Something went wrong',
    body: 'We could not load this. Try again in a moment.',
    retry: 'Retry',
    support: 'Contact support',
  },
  offline: {
    heading: 'You are offline',
    body: 'Check your internet connection, then try again.',
    retry: 'Try again',
  },
  noAccess: {
    heading: 'You do not have access',
    body: 'Ask the store owner to give you access to this page.',
    request: 'Request access',
  },
  notFound: {
    heading: 'We could not find that page',
    body: 'It may have moved or been deleted.',
    home: 'Go to home',
  },
  empty: {
    heading: 'Nothing here yet',
    body: 'Add your first item to get started.',
    add: 'Add item',
  },
} as const
