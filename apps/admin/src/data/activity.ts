/** Copy for the activity bell in the top bar. */
export const activityContent = {
  label: 'Notifications',
  unread: (n: number) => `${n} new`,
  markAllRead: 'Mark all read',
  attentionHeading: 'Needs your attention',
  recentHeading: 'Last 7 days',
  /** Figma "TB · Notifications": filter tabs, day groups and the settings link. */
  tabs: { all: 'All', orders: 'Orders', payments: 'Payments', stock: 'Stock' },
  todayHeading: 'Today',
  earlierHeading: 'Earlier',
  settings: 'Notification settings',
  emptyTab: 'Nothing here right now.',
  footer: 'Orders, refunds, returns and stock from the last 7 days.',
  empty: {
    title: 'You are all caught up',
    body: 'New orders, refunds, returns and stock alerts show up here.',
  },
  failed: 'Could not load notifications. Trying again in a minute.',
  attention: {
    refundsFailed: {
      title: (n: number) => (n === 1 ? '1 refund failed' : `${n} refunds failed`),
      detail: 'The gateway refused it, so the shopper has not got the money back.',
    },
    refundsNeeded: {
      title: (n: number) => (n === 1 ? '1 payment to refund' : `${n} payments to refund`),
      detail: 'Paid twice, or paid after the order was cancelled.',
    },
    returnsRequested: {
      title: (n: number) => (n === 1 ? '1 return to review' : `${n} returns to review`),
      detail: 'Approve or decline so the shopper knows what happens next.',
    },
    outOfStock: {
      title: (n: number) => (n === 1 ? '1 item out of stock' : `${n} items out of stock`),
      detail: 'Shoppers cannot buy these until you restock.',
    },
    lowStock: {
      title: (n: number) => (n === 1 ? '1 item running low' : `${n} items running low`),
      detail: 'Restock soon to keep them on sale.',
    },
    mediaFailed: {
      title: (n: number) =>
        n === 1 ? '1 photo could not be processed' : `${n} photos could not be processed`,
      detail: 'Open Files to retry or replace them.',
    },
  },
  event: {
    order: (number: number) => `New order #${number}`,
    refund_needed: (number: number) => `Refund due on order #${number}`,
    return: (number: number) => `Return R-${number} requested`,
  },
}
