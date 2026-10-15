import type { LucideIcon } from '@commerce/ui/icons'
import { Bell, Language, Monitor, Palette, ShieldCheck, Store, UserRound } from '@commerce/ui/icons'
import { routes } from '@/lib/routes'

export type AccountPage = {
  /** Its name in `accountContent.pages`, so the rail and the menu follow the admin language. */
  id: keyof typeof accountContent.pages
  href: string
  title: string
  icon: LucideIcon
}

/**
 * Your own pages, opened from the account menu (the avatar, top right) and listed in the
 * Account rail. They belong to the signed-in member, not to the store; store-wide choices
 * stay in Settings. The old Settings addresses redirect here (lib/settings-redirects).
 */
export const ACCOUNT_NAV: AccountPage[] = [
  { id: 'profile', href: routes.account.home(), title: 'Profile', icon: UserRound },
  {
    id: 'security',
    href: routes.account.security(),
    title: 'Sign-in & security',
    icon: ShieldCheck,
  },
  { id: 'sessions', href: routes.account.sessions(), title: 'Sessions', icon: Monitor },
  {
    id: 'notifications',
    href: routes.account.notifications(),
    title: 'Notifications',
    icon: Bell,
  },
  { id: 'stores', href: routes.account.stores(), title: 'Stores', icon: Store },
  { id: 'language', href: routes.account.language(), title: 'Language & region', icon: Language },
  { id: 'appearance', href: routes.account.appearance(), title: 'Appearance', icon: Palette },
]

/** The account menu keeps two short entries: Account (opens Profile) and Appearance. */
export const ACCOUNT_MENU: AccountPage[] = [
  { id: 'account', href: routes.account.home(), title: 'Account', icon: UserRound },
  { id: 'appearance', href: routes.account.appearance(), title: 'Appearance', icon: Palette },
]

/** Copy for Account: the signed-in member's own pages. */
export const accountContent = {
  title: 'Account',
  intro: 'Your own details and preferences. They apply to you, not to your staff.',
  nav: {
    label: 'Your account',
  },
  /** Rail and menu names, by `AccountPage.id`. */
  pages: {
    account: 'Account',
    profile: 'Profile',
    security: 'Sign-in & security',
    sessions: 'Sessions',
    notifications: 'Notifications',
    stores: 'Stores',
    language: 'Language & region',
    appearance: 'Appearance',
  },
  profile: {
    title: 'Profile',
    intro: 'How your team sees you, and where we reach you.',
    photo: {
      heading: 'Photo',
      body: 'Shown beside your name in the admin. Without one, your initials show.',
      upload: 'Upload photo',
      change: 'Change photo',
      remove: 'Remove',
      saved: 'Photo saved',
      removed: 'Photo removed',
      failed: 'Could not save the photo. Try again.',
      tooBig: 'That photo is over 10 MB. Pick a smaller one.',
      notImage: 'Pick a JPG, PNG or WebP photo.',
      hint: 'JPG, PNG or WebP. You can crop it next.',
    },
    crop: {
      title: 'Crop your photo',
      body: 'Drag the photo to move it. Use the slider to zoom.',
      zoom: 'Zoom',
      save: 'Use this photo',
      cancel: 'Cancel',
    },
    details: {
      heading: 'Your details',
      body: 'Your name shows on staff lists and on changes you make.',
      name: 'Full name',
      nameHelp: 'As your team knows you.',
      email: 'Email',
      emailHelp: 'You sign in with this email. Change it in Sign-in & security.',
      phone: 'Mobile number',
      phoneHelp: 'For your own WhatsApp alerts. Indian numbers need no +91.',
    },
    save: 'Save',
    discard: 'Discard',
    unsaved: 'Unsaved changes',
    saved: 'Profile saved',
    failed: 'Could not save your profile. Try again.',
    loadFailed: 'Your profile did not load.',
    retry: 'Try again',
    danger: {
      heading: 'Delete my account',
      body: 'Removes you from every store you work in and deletes your sign-in, photo and devices. The stores and their orders stay.',
      button: 'Delete my account',
      blocked: (stores: string) =>
        `You own ${stores}. A store always keeps its owner, so hand it over (Settings → Staff) or close it first.`,
      dialog: {
        title: 'Delete your account?',
        body: 'This cannot be undone. You leave every store straight away and are signed out everywhere.',
        typeEmail: (email: string) => `Type ${email} to confirm`,
        sendCode: 'Send code',
        codeSent: (email: string) => `We sent a 6-digit code to ${email}.`,
        code: 'Code',
        confirm: 'Delete my account',
        cancel: 'Cancel',
        mismatch: 'That is not your sign-in email.',
        failed: 'Could not delete your account. Try again.',
        done: 'Your account was deleted',
      },
    },
  },
  notifications: {
    title: 'Notifications',
    intro: (store: string) =>
      `Your own alerts for ${store}. Each person on your team picks their own.`,
    heading: 'What you hear about',
    body: 'Pick how each one reaches you.',
    channels: { email: 'Email', whatsapp: 'WhatsApp' },
    alerts: {
      newOrder: { label: 'New order', help: 'Each order as it comes in.' },
      lowStock: { label: 'Low stock', help: 'When a product runs low.' },
      paymentProblem: {
        label: 'Payment or payout problem',
        help: 'A failed payment, refund or payout that needs you.',
      },
      dailySummary: {
        label: 'Daily summary',
        help: 'Orders, sales and what waits to ship, once a day.',
      },
      appErrors: {
        label: 'App or integration error',
        help: 'When a connected app or courier stops working.',
      },
    },
    summaryTime: 'Send at',
    hourLabel: (hour: number) =>
      `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour < 12 ? 'am' : 'pm'}`,
    whatsappOff:
      'WhatsApp alerts appear here once your store sets up WhatsApp in Settings → Notifications.',
    needPhone: 'Add your mobile number on your Profile to get WhatsApp alerts.',
    addPhone: 'Add mobile number',
    soon: 'Coming soon: these switches are saved now and start sending in an update.',
    soonBadge: 'Soon',
    storeWide: 'The store can switch team alerts off for everyone in Settings → Notifications.',
    save: 'Save',
    discard: 'Discard',
    unsaved: 'Unsaved changes',
    saved: 'Notifications saved',
    failed: 'Could not save. Try again.',
    loadFailed: 'Your notifications did not load.',
    retry: 'Try again',
  },
  /** "Chrome on Windows", "Safari on iPhone"; any part may be unknown. */
  device: {
    label: (browser: string | null, os: string | null) =>
      browser && os ? `${browser} on ${os}` : (browser ?? os ?? 'Unknown device'),
    unknownPlace: 'Place unknown',
    ip: (masked: string) => `IP ${masked}`,
  },
  security: {
    title: 'Sign-in & security',
    intro: 'How you sign in, and where you signed in lately.',
    email: {
      heading: 'Sign-in email',
      body: 'We send your sign-in codes to this address.',
      label: 'Email',
      change: 'Change email',
    },
    changeEmail: {
      title: 'Change your sign-in email',
      body: 'We send a code to the new address. Your old address gets a note that it changed.',
      newEmail: 'New email',
      placeholder: 'you@example.com',
      send: 'Send code',
      codeTitle: 'Enter the code',
      sentTo: (email: string) =>
        `We sent a 6-digit code to ${email}. Not there in a few minutes? Check the address, or it may already belong to another account.`,
      code: 'Code',
      confirm: 'Change email',
      back: 'Use a different email',
      cancel: 'Cancel',
      done: (email: string) => `You now sign in with ${email}`,
      invalidEmail: 'Enter a full email address, like you@example.com',
      failed: 'Could not change your email. Try again.',
    },
    google: {
      heading: 'Google',
      body: 'Sign in with the Google account that uses your sign-in email.',
      linked: 'Linked',
      linkedOn: (date: string) => `Linked on ${date}`,
      notLinked:
        'Not linked yet. On the login page, click Continue with Google and pick the Google account with your sign-in email.',
    },
    passkeys: {
      heading: 'Passkeys',
      body: 'Sign in with your fingerprint, face or screen lock instead of a code. Each device or password manager keeps its own passkey.',
      add: 'Add a passkey',
      empty: 'No passkeys yet. Add one on each device you use.',
      unsupported: 'This browser cannot make passkeys. Try Chrome, Safari or Edge.',
      unnamed: 'Passkey',
      added: (date: string) => `Added ${date}`,
      synced: 'Synced',
      rename: 'Rename',
      remove: 'Remove',
      nameLabel: 'Passkey name',
      namePlaceholder: 'e.g. Work laptop',
      save: 'Save',
      cancel: 'Cancel',
      created: 'Passkey added',
      renamed: 'Passkey renamed',
      removed: 'Passkey removed',
      failed: 'That did not work. Try again.',
      cancelled: 'Passkey not added',
      removeDialog: {
        title: (name: string) => `Remove ${name}?`,
        body: 'You will not be able to sign in with it any more. You can still sign in with a code by email.',
        confirm: 'Remove passkey',
        cancel: 'Cancel',
      },
    },
    recent: {
      heading: 'Recent sign-ins',
      body: 'The last 10 times someone signed in to your account. Not you? Sign the device out on Sessions and change your email.',
      empty: 'No sign-ins recorded yet. New sign-ins show here.',
      thisDevice: 'This device',
      methods: {
        email_otp: 'Code by email',
        passkey: 'Passkey',
        google: 'Google',
        other: 'Other',
      },
    },
    loadFailed: 'This page did not load.',
    retry: 'Try again',
  },
  sessions: {
    title: 'Sessions',
    intro: (count: number) =>
      count === 1 ? 'Signed in on 1 device.' : `Signed in on ${count} devices.`,
    heading: 'Where you are signed in',
    body: 'Sign out of any device you do not recognise or no longer use.',
    thisDevice: 'This device',
    signedIn: (when: string) => `Signed in ${when}`,
    lastActive: (when: string) => `Active ${when}`,
    signOut: 'Sign out',
    signOutOthers: 'Sign out everywhere else',
    onlyThis: 'This is the only device signed in.',
    note: 'A device you sign out may keep an open page for up to 5 minutes; after that it has to sign in again.',
    signOutDialog: {
      title: (device: string) => `Sign out ${device}?`,
      body: 'That device has to sign in again with a code or passkey.',
      confirm: 'Sign out',
      cancel: 'Cancel',
    },
    othersDialog: {
      title: 'Sign out everywhere else?',
      body: 'Every other phone and computer has to sign in again. This one stays signed in.',
      confirm: 'Sign out others',
      cancel: 'Cancel',
    },
    signedOut: 'Device signed out',
    othersSignedOut: 'Signed out everywhere else',
    failed: 'That did not work. Try again.',
    loadFailed: 'Your devices did not load.',
    retry: 'Try again',
  },
  stores: {
    title: 'Stores',
    intro: (count: number) =>
      count === 1 ? 'You work in 1 store.' : `You work in ${count} stores.`,
    heading: 'Your stores',
    body: 'Every store you can open, and your role in each.',
    owner: 'Owner',
    current: 'Current',
    noRole: 'Member',
    joined: (date: string) => `Joined ${date}`,
    switchTo: 'Switch to',
    switchFailed: 'Could not switch store. Try again.',
    leave: 'Leave',
    ownerCannotLeave: 'You own this store, so you cannot leave it.',
    leaveDialog: {
      title: (store: string) => `Leave ${store}?`,
      body: 'You lose access to this store straight away. To come back, an owner or admin has to invite you again.',
      lastStore: 'This is your only store. After leaving, you can create a new one.',
      confirm: 'Leave store',
      cancel: 'Cancel',
      done: (store: string) => `You left ${store}`,
      failed: 'Could not leave the store. Try again.',
    },
    loadFailed: 'Your stores did not load.',
    retry: 'Try again',
  },
  language: {
    title: 'Language & region',
    intro: 'How the admin speaks to you and shows times. Saved on this browser.',
    heading: 'Admin language',
    body: 'The language this admin shows in. Your storefront and customer messages do not change.',
    label: 'Language',
    options: { en: 'English', hi: 'हिंदी (Hindi)' },
    partial: 'Some pages are still in English. They switch over as they are translated.',
    saved: 'Language changed',
  },
  region: {
    heading: 'Dates and times',
    body: 'Times are always shown in India time (IST).',
    clock: {
      label: 'Time format',
      help: 'How times show in lists and on orders.',
      options: { '12h': '12-hour (4:05 pm)', '24h': '24-hour (16:05)' },
    },
    weekStart: {
      label: 'Week starts on',
      help: 'The first day of the week in calendars and day pickers.',
      options: { mon: 'Monday', sun: 'Sunday' },
    },
    saved: 'Saved',
  },
  switcher: {
    label: 'Language',
  },
}
