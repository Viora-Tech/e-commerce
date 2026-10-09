/** Copy for the Back in stock app's admin pages. */
export const backInStockContent = {
  overview: {
    title: 'Overview',
    subtitle: 'Usage this month and demand for sold-out variants.',
    emailUsage: 'Email alerts',
    whatsappUsage: 'WhatsApp alerts',
    unlimited: 'Unlimited (no quota)',
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
    saved: 'Settings saved',
    failed: 'Could not save settings',
  },
} as const
