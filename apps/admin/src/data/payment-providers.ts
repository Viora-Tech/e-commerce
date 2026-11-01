/** Settings → Payments' sections (providers, manual methods, configuration) and a provider's page. */
export const paymentProvidersContent = {
  overview: {
    providers: {
      heading: 'Payment providers',
      help: 'The companies that take online payments at checkout: UPI, cards, netbanking and wallets.',
      add: 'Add provider',
      empty: 'No payment provider yet',
      emptyHelp: 'Connect one to take UPI, cards and netbanking online.',
      choose: 'Choose a provider',
      main: 'Main',
      more: (n: number) => `+${n}`,
      order: 'Checkout order',
      orderHelp: 'Which provider checkout tries first, and which one is on',
    },
    manual: {
      heading: 'Manual payment methods',
      help: 'Shoppers pay you directly. You mark the order paid when the money arrives.',
      add: 'Method',
      all: 'All manual methods',
    },
    config: {
      heading: 'Payment configuration',
      help: 'How payments are taken and which ways to pay shoppers see.',
    },
  },
  status: {
    active: 'Active',
    inactive: 'Inactive',
    test: 'Test mode',
    attention: 'Needs attention',
  },
  provider: {
    manageKeys: 'Manage keys',
    more: 'More actions',
    makeMain: 'Make main provider',
    madeMain: (name: string) => `${name} is now tried first at checkout.`,
    makeMainFailed: 'Could not save. Try again.',
    mainHelp: 'Main provider: checkout tries it first.',
    notFound: 'This payment provider is not available in your shop.',
    notConnected: 'Not connected yet',
    about: {
      heading: (name: string) => `About ${name}`,
      fees: 'Fees',
      connection: 'Connection',
      lastPayment: 'Last payment',
      noPaymentsYet: 'No payments yet',
    },
    methods: {
      heading: 'Payment methods',
      help: (name: string) =>
        `The ways to pay ${name} takes. Turning one off hides it at checkout for every provider.`,
      routedTo: (name: string) => `Checkout sends this to ${name}`,
      turnOn: (name: string) => `Turn ${name} on`,
      none: 'This provider does not list its ways to pay.',
      saved: 'Saved.',
      saveFailed: 'Could not save. Try again.',
    },
  },
} as const
