/**
 * Copy for a payment gateway's Live ⇄ Test switch, its Active/Inactive switch
 * and the "Test mode" warnings (Settings → Payments, the admin banner).
 */

export type PaymentModeId = 'test' | 'live'

export const paymentModesContent = {
  testBar: {
    title: 'Test mode — no real money moves',
    body: 'Shoppers see a "Test mode" badge at checkout. Orders paid now are marked Test and kept out of your reports and GST invoices.',
    banner: 'Test mode — payments are not real.',
    bannerLink: 'Payments settings',
    /** The strip on a gateway's card. */
    note: 'Test mode — no real money moves',
    noteBody: 'Checkout uses your test keys. Orders are marked Test and kept out of your reports.',
  },
  mode: {
    label: 'Keys in use',
    heading: 'Payments mode',
    help: 'Live takes real payments. Test lets you try checkout without real money. Switching never deletes keys.',
    badge: { live: 'Live', test: 'Test mode' } satisfies Record<PaymentModeId, string>,
    keysLabel: (mode: PaymentModeId) => (mode === 'live' ? 'Live keys' : 'Test keys'),
    status: {
      'in-use': 'In use at checkout',
      saved: 'Saved',
      missing: 'Not added',
    },
    editKeys: (mode: PaymentModeId) => (mode === 'live' ? 'Edit live keys' : 'Edit test keys'),
    blocked: (mode: PaymentModeId) =>
      mode === 'live'
        ? 'Add your live keys before going live. Checkout stays on your test keys until then.'
        : 'Add your test keys before switching to test. Checkout stays on your live keys until then.',
    testHeading: 'Test mode',
    testHelp: 'See how payments and orders work on your store, without real money',
    test: 'Test',
    live: 'Live',
    missing: (mode: PaymentModeId) =>
      mode === 'live' ? 'Add your live keys first.' : 'Add your test keys first.',
    addKeys: (mode: PaymentModeId) => (mode === 'live' ? 'Add live keys' : 'Add test keys'),
    toLive: {
      title: 'Start taking real payments?',
      body: 'Checkout switches to your live keys. Shoppers will pay real money. We check your live keys with the payment company first.',
      confirm: 'Go live',
    },
    toTest: {
      title: 'Switch to test mode?',
      body: 'Checkout switches to your test keys. Shoppers cannot pay real money until you go live again. Your live keys stay saved.',
      confirm: 'Switch to test',
    },
    switched: (mode: PaymentModeId) =>
      mode === 'live' ? 'Live. Payments are real now.' : 'Test mode is on.',
    failed: 'Could not switch. Try again.',
  },
  active: {
    label: 'Active',
    on: 'Active',
    off: 'Inactive',
    offTitle: 'Turn this payment company off?',
    offBody:
      'Shoppers stop seeing it at checkout right away. Its keys and settings stay saved, so you can turn it back on any time.',
    onlyOnline:
      'This is your only online way to get paid. Shoppers will only see cash on delivery or bank transfer, if those are on.',
    confirmOff: 'Turn off',
    turnedOff: 'Turned off. It is gone from checkout.',
    turnedOn: 'Turned on. It is back at checkout.',
    failed: 'Could not save. Try again.',
    deactivate: (name: string) => `Deactivate ${name}`,
    activate: (name: string) => `Activate ${name}`,
    inactiveHelp: 'Off: shoppers do not see it at checkout. Its keys and settings are saved.',
  },
  keySet: {
    pickerLabel: 'Keys for',
    checkoutUses: (mode: PaymentModeId) =>
      mode === 'live' ? 'Checkout uses your live keys.' : 'Checkout uses your test keys.',
    editing: (mode: PaymentModeId) =>
      mode === 'live' ? 'You are editing your live keys.' : 'You are editing your test keys.',
    waiting: (mode: PaymentModeId) =>
      mode === 'live'
        ? 'Saved. Checkout still uses your test keys; switch to Live on the Payments page when you are ready.'
        : 'Saved. Checkout still uses your live keys; switch to Test on the Payments page to try things out.',
  },
  others: {
    heading: 'Other payment companies',
  },
}
