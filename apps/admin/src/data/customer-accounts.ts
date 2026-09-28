import type { LoginMethod } from '@commerce/core/customer-accounts'

/** Settings → Customer accounts. */
export const customerAccountsContent = {
  title: 'Customer accounts',
  subtitle: 'How customers sign in to your store, and whether they need an account to buy.',
  save: 'Save',
  saved: 'Customer account settings saved',
  failed: 'Could not save. Try again.',
  loadFailed: 'Could not load customer account settings.',
  checkout: {
    heading: 'At checkout',
    choices: {
      guest: {
        label: 'Anyone can check out',
        hint: 'Accounts are optional. Customers can sign in to see orders and save addresses. Best for most stores.',
      },
      account_required: {
        label: 'Customers must sign in first',
        hint: 'Every buyer signs in with a code before paying. Fewer quick orders, but every order has an account.',
      },
    },
  },
  methods: {
    heading: 'Ways to sign in',
    body: 'Customers get a one-time code. No passwords to forget.',
    unavailable: 'Needs an app',
    turnOnApp: 'Set up in Notifications',
    stillOn: (list: string) =>
      `${list} is switched on but the app that sends it is off, so customers do not see it. They can still use the other ways.`,
    needOne: 'Keep at least one way to sign in switched on.',
  },
  deletion: {
    heading: 'Deleting an account',
    body: 'Customers can delete their account from their account page. They confirm with a code, are signed out everywhere, and a deletion request lands in Customer privacy for you to finish.',
    link: 'Open Customer privacy',
  },
} as const

export const LOGIN_METHOD_COPY: Record<
  LoginMethod,
  { label: string; hint: string; needs: string }
> = {
  email: {
    label: 'Email code',
    hint: 'A six digit code to their inbox.',
    needs: 'Needs an email app, or the store email sender.',
  },
  sms: {
    label: 'SMS code',
    hint: 'A code by text message to their mobile.',
    needs: 'Needs an SMS app.',
  },
  whatsapp: {
    label: 'WhatsApp code',
    hint: 'A code on WhatsApp. Needs an approved sign-in template in WhatsApp Manager.',
    needs: 'Needs the WhatsApp app.',
  },
}
