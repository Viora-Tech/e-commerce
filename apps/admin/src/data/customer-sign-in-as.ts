/** Customer page › More actions › "Sign in as customer": open the store as this shopper. */
export const customerSignInAsContent = {
  menu: 'Sign in as customer',
  title: 'Sign in as this customer?',
  body: (name: string) =>
    `The store opens in a new tab, signed in as ${name} for one hour. You see their cart, orders and addresses, and anything you do there is done as them. Their timeline and the activity log record that you signed in.`,
  unnamed: 'this customer',
  confirm: 'Open the store',
  cancel: 'Cancel',
  failed: 'Could not sign in as this customer. Try again.',
} as const
