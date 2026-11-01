/** Copy for the Back in stock app's admin pages. */
export const backInStockContent = {
  overview: {
    title: 'Overview',
    subtitle: 'Usage this month and demand for sold-out variants.',
    emailUsage: 'Email alerts',
    whatsappUsage: 'WhatsApp alerts',
    unlimited: 'Unlimited (no quota)',
    whatsappVia: 'Sent through your WhatsApp channel',
    ofQuota: (sent: number, quota: number) =>
      `${sent.toLocaleString()} of ${quota.toLocaleString()}`,
    paused: 'Paused: this month’s free quota is used up. Sends resume next month.',
    demandTitle: 'Top variants by waiting count',
    demandEmpty: 'No one is waiting for a sold-out variant yet.',
    columns: { variant: 'Variant', waiting: 'Waiting' },
  },
  signups: {
    title: 'Signups',
    subtitle: 'Everyone who asked to be notified.',
    empty: 'No signups yet.',
    restockTags: 'Bring over restock tags',
    restockTagsBusy: 'Bringing over…',
    restockTagsDone: (added: number, unmatched: number) =>
      `${added} ${added === 1 ? 'signup' : 'signups'} added from customers tagged restock-…` +
      (unmatched > 0
        ? `; ${unmatched} ${unmatched === 1 ? 'tag names' : 'tags name'} a product not here.`
        : '.'),
    resource: { singular: 'signup', plural: 'signups' },
    columns: {
      variant: 'Variant',
      contact: 'Contact',
      status: 'Status',
      created: 'Signed up',
    },
    status: {
      pending_confirmation: 'Pending confirmation',
      confirmed: 'Confirmed',
      notified: 'Notified',
      unsubscribed: 'Unsubscribed',
    },
  },
  settings: {
    title: 'Settings',
    subtitle: 'Channels, message copy and how fast alerts go out.',
    channels: 'Channels',
    emailEnabled: 'Send email alerts',
    whatsappEnabled: 'Send WhatsApp alerts',
    whatsappHelp: 'Only sends if this store has a WhatsApp channel configured.',
    batchSize: 'Alerts sent per minute',
    batchSizeHelp:
      'Throttles a restock so a big waiting list does not flood your sending quota at once.',
    save: 'Save',
    discard: 'Discard',
    unsaved: 'Unsaved changes',
    saved: 'Settings saved',
    failed: 'Could not save settings',
  },
} as const
