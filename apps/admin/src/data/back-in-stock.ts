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
    subtitle: 'Changes save together. Each section says what it controls.',
    channels: 'Channels',
    channelsHelp: 'How shoppers hear that a variant is back.',
    emailEnabled: 'Email',
    emailHelp: 'One email when the variant is back',
    whatsappEnabled: 'WhatsApp',
    whatsappHelp: 'Needs the WhatsApp app set up',
    sending: 'Sending',
    sendingHelp: 'Keeps a big waiting list from using your sending quota at once.',
    batchSize: 'Alerts per minute',
    /** The hint under "Alerts per minute": how long a 500-signup restock takes at that pace. */
    batchSizeHint: (signups: number, minutes: number) =>
      minutes === 0
        ? `A restock of ${signups.toLocaleString('en-IN')} signups goes out within a minute.`
        : `A restock of ${signups.toLocaleString('en-IN')} signups goes out over about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`,
    storefront: 'Storefront',
    storefrontHelp: 'The “Notify me” button on sold-out products.',
    buttonText: 'Button text',
    /** The empty choice: the storefront's own words, marked as the default. */
    buttonTextDefault: (label: string) => `${label} (default)`,
    askPhone: 'Ask for a phone number',
    askPhoneHelp: 'Only shown when WhatsApp is on',
    save: 'Save',
    discard: 'Discard',
    saving: 'Saving…',
    saved: 'Settings saved',
    failed: 'Could not save settings',
  },
} as const
