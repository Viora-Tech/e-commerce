/** Copy for the unsubscribe page reached from marketing emails. */
export const unsubscribeContent = {
  title: 'Email preferences',
  subscribed: (email: string) => `${email} gets news and offers from us.`,
  confirm: 'Unsubscribe from marketing emails',
  keep: 'Keep me subscribed',
  unsubscribed: (email: string) =>
    `${email} is unsubscribed. You will still get emails about your orders.`,
  resubscribe: 'Subscribe again',
  resubscribed: 'You are subscribed again. Thanks for coming back.',
  invalid: 'This link is not valid any more.',
  home: 'Back to the store',
} as const

/** Copy for the page the newsletter confirm email links to (double opt-in). */
export const newsletterConfirmContent = {
  title: 'Confirm your email',
  ask: (email: string) => `Tap the button to start getting news and offers at ${email}.`,
  confirm: 'Yes, subscribe me',
  done: (email: string) =>
    `Thanks, ${email} is subscribed. You can unsubscribe from any email we send.`,
  invalid: 'This link has expired or is not valid. Sign up again from the store to get a new one.',
  home: 'Back to the store',
} as const
