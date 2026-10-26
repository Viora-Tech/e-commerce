/** The storefront's error pages: a page that failed, the checkout, and the whole store failing. */
export const errorPageContent = {
  store: {
    title: 'Sorry, this page didn’t load',
    body: 'Something went wrong on our side. Try again, and if it keeps happening we’re happy to help.',
    secondary: 'Go to the home page',
  },
  checkout: {
    title: 'Checkout hit a snag',
    body: 'Something went wrong on our side. Your cart is saved, so try again or head back to it.',
    secondary: 'Back to cart',
  },
  global: {
    /** The browser tab's title while the store itself could not load. */
    tabTitle: 'Something went wrong',
    title: 'We’ll be right back',
    body: 'The store couldn’t load just now. Please try again in a moment.',
    secondary: 'Go to the home page',
  },
  retry: 'Try again',
  retrying: 'Trying again…',
  help: 'Need help?',
  whatsapp: 'WhatsApp us',
  email: 'Email us',
  /** The error's digest, for support to find it in the logs. */
  reference: (digest: string) => `Error reference: ${digest}`,
}

/** The bare 404 for an address that is not a store page at all. */
export const bareNotFoundContent = {
  title: 'Page not found',
  body: 'This address doesn’t lead anywhere. Check the link, or start again from the home page.',
  home: 'Go to the home page',
}
