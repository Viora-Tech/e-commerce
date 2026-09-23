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
