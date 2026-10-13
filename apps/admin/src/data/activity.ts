/** Copy for the activity bell in the top bar. */
export const activityContent = {
  label: 'Activity',
  unread: (n: number) => `${n} new`,
  attentionHeading: 'Needs your attention',
  recentHeading: 'Last 7 days',
  empty: 'Nothing to catch up on.',
  failed: 'Could not load activity.',
  attention: {
    refundsNeeded: (n: number) =>
      n === 1
        ? '1 payment to refund (paid twice or after cancelling)'
        : `${n} payments to refund (paid twice or after cancelling)`,
    outOfStock: (n: number) => (n === 1 ? '1 item out of stock' : `${n} items out of stock`),
    lowStock: (n: number) => (n === 1 ? '1 item running low' : `${n} items running low`),
    returnsRequested: (n: number) =>
      n === 1 ? '1 return request to review' : `${n} return requests to review`,
    mediaFailed: (n: number) =>
      n === 1 ? '1 photo could not be processed' : `${n} photos could not be processed`,
  },
  event: {
    order: (number: number, total: string) => `New order #${number} · ${total}`,
    refund_needed: (number: number, amount: string) => `Refund ${amount} on order #${number}`,
    return: (number: number) => `Return R-${number} requested`,
  },
}
