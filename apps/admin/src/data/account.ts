import type { LucideIcon } from '@commerce/ui/icons'
import { Palette, UserRound } from '@commerce/ui/icons'
import { routes } from '@/lib/routes'

export type AccountPage = { href: string; title: string; icon: LucideIcon }

/**
 * Your own preferences, opened from the account menu (the avatar, top right). They belonged to
 * Settings until October 2026; the old Settings addresses redirect here (lib/settings-redirects).
 */
export const ACCOUNT_PAGES: AccountPage[] = [
  { href: routes.account.home(), title: 'Account', icon: UserRound },
  { href: routes.account.appearance(), title: 'Appearance', icon: Palette },
]

/** Copy for Account: the signed-in member's own preferences. */
export const accountContent = {
  title: 'Account',
  intro: 'Your own preferences. They apply to you on this browser, not to your staff.',
  nav: {
    label: 'Your account',
  },
  language: {
    heading: 'Admin language',
    body: 'The language this admin shows in. Your storefront and customer messages do not change.',
    label: 'Language',
    options: { en: 'English', hi: 'हिंदी (Hindi)' },
    partial: 'Some pages are still in English. They switch over as they are translated.',
    saved: 'Language changed',
  },
  switcher: {
    label: 'Language',
  },
}
