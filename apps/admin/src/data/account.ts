import type { LucideIcon } from '@commerce/ui/icons'
import { Language, Palette, Store, UserRound } from '@commerce/ui/icons'
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
      emailHelp: 'You sign in with this email.',
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
