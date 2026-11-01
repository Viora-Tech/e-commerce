import type { LoginMethod, LoginProvider } from '@commerce/core/customer-accounts'

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
    /** #108: said before saving, not after the save is refused. */
    noSender:
      'Sign-in codes need an app that sends them (email, SMS or WhatsApp). Turn one on in Apps before asking customers to sign in.',
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
  providers: {
    heading: 'Sign in with an account they already have',
    body: 'One tap instead of a code. Customers who already bought from you stay the same customer: we match them by an email or mobile number the provider has checked.',
    usesPlatform: 'Ready to use. No setup needed.',
    usesOwn: 'Uses your own app.',
    needsSetup: 'Needs setup before customers see it.',
    setUp: 'Set up',
    change: 'Change',
    notOnPlatform: 'Needs your own app.',
    useOwn: 'Use my own app',
    useOwnHint: 'Your shop name shows on the sign-in screen instead of ours.',
    stillHidden: (list: string) =>
      `${list} is switched on but not set up yet, so customers do not see it.`,
    oneTap: {
      label: 'Google One Tap',
      hint: 'Shows "Continue as" with the customer’s Google account on your sign-in page.',
      needsOwn: 'Needs your own Google app, with your shop’s web address added to it.',
    },
  },
  extras: {
    heading: 'More ways to sign in',
    magicLink: {
      label: 'Sign-in link by email',
      hint: 'Customers can ask for a link instead of typing a code.',
      needsEmail: 'Turn on email codes first. The link goes to the same inbox.',
    },
    passkeys: {
      label: 'Passkeys',
      hint: 'After signing in once, customers can add a passkey and sign in with their fingerprint, face or screen lock. A passkey works on the web address it was added on.',
    },
    rememberDevice: {
      label: 'Remember this device',
      hint: 'Customers choose: ticked stays signed in for 90 days, unticked signs out when the browser closes. Off: everyone stays signed in for 30 days.',
    },
  },
  sheet: {
    save: 'Save app',
    saving: 'Saving',
    saved: 'App saved',
    remove: 'Remove my app',
    removed: 'App removed',
    failed: 'Could not save. Check every field and try again.',
    redirectLabel: 'Redirect address to add in your app',
    copy: 'Copy',
    copied: 'Copied',
    secretKept: 'Saved. Leave as it is to keep it.',
  },
  /** The row list the page opens on (#147): each row's current value. */
  rows: {
    back: 'Customer accounts',
    guest: 'Anyone can check out',
    required: 'Sign-in required',
    none: 'None',
    extrasValue: 'Sign-in link, Truecaller and more',
    deletionValue: 'From their account page',
  },
  deletion: {
    heading: 'Deleting an account',
    body: 'Customers can delete their account from their account page. They confirm with a code, are signed out everywhere, and a deletion request lands in Customer privacy for you to finish.',
    link: 'Open Customer privacy',
  },
} as const

type ProviderCopy = {
  label: string
  hint: string
  setupTitle: string
  /** Short numbered steps, one action each. */
  steps: string[]
  fields: Record<string, { label: string; help?: string }>
}

/** Each provider on the page, and the guided setup for the merchant's own app. */
export const PROVIDER_COPY: Record<LoginProvider, ProviderCopy> = {
  google: {
    label: 'Google',
    hint: 'Continue with Google.',
    setupTitle: 'Your own Google app',
    steps: [
      'Open Google Cloud Console, then APIs and services, then Credentials.',
      'Create an OAuth client ID of type Web application.',
      'Under Authorised redirect URIs, add the address below.',
      'For One Tap, also add your shop’s web address under Authorised JavaScript origins.',
      'Copy the client ID and client secret here.',
    ],
    fields: {
      clientId: { label: 'Client ID' },
      clientSecret: { label: 'Client secret' },
    },
  },
  apple: {
    label: 'Apple',
    hint: 'Continue with Apple. Popular on iPhone.',
    setupTitle: 'Your own Apple app',
    steps: [
      'In your Apple Developer account, open Certificates, Identifiers and Profiles.',
      'Create a Services ID and turn on Sign in with Apple for it.',
      'Add the redirect address below as a Return URL, and our login domain as a domain.',
      'Create a key with Sign in with Apple on and download the .p8 file.',
      'Paste the Services ID, your Team ID, the key ID and the .p8 file contents here.',
    ],
    fields: {
      servicesId: { label: 'Services ID', help: 'Looks like com.yourshop.web' },
      teamId: { label: 'Team ID' },
      keyId: { label: 'Key ID' },
      privateKey: { label: 'Private key (.p8 file contents)' },
    },
  },
  facebook: {
    label: 'Facebook',
    hint: 'Continue with Facebook. Instagram has no sign-in for shoppers, so Facebook covers Meta accounts.',
    setupTitle: 'Your own Facebook app',
    steps: [
      'In Meta for Developers, create an app of type Consumer and add Facebook Login.',
      'Under Facebook Login settings, add the address below as a Valid OAuth Redirect URI.',
      'Ask for the email permission.',
      'Copy the App ID and App secret from App settings, Basic.',
    ],
    fields: {
      appId: { label: 'App ID' },
      appSecret: { label: 'App secret' },
    },
  },
  truecaller: {
    label: 'Truecaller',
    hint: 'Continue with Truecaller on Android phones in India. No code to wait for.',
    setupTitle: 'Your own Truecaller app',
    steps: [
      'Sign up on the Truecaller developer portal and create an app for mobile websites.',
      'Set its callback address to the address below.',
      'Copy the partner key and the app name you registered here.',
    ],
    fields: {
      partnerKey: { label: 'Partner key' },
      partnerName: { label: 'App name', help: 'Exactly as registered with Truecaller.' },
    },
  },
}

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
