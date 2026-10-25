import { siteConfig } from '@commerce/config/site'

const domain = siteConfig.brand.domain
const brand = siteConfig.brand.name

export type ChangeTag = 'New' | 'Improved' | 'Fixed'

export type ChangelogEntry = {
  date: string
  tags: readonly ChangeTag[]
  title: string
  body: string
  screen?: { src: string; alt: string; width: number; height: number; url: string }
}

export const changelogContent = {
  eyebrow: 'Changelog',
  title: `What’s new in ${brand}.`,
  subtitle: 'Every change, newest first, in plain words.',
  subscribe: {
    label: 'Email',
    placeholder: 'you@yourstore.in',
    button: 'Subscribe',
    note: 'One email when something ships. No spam.',
    done: 'You are subscribed. We will email you when something ships.',
    invalid: 'Enter a valid email address',
    error: 'That did not go through. Try again in a moment.',
  },
  filterLabel: 'Filter by tag',
  filters: ['All', 'New', 'Improved', 'Fixed'] as const,
  latest: 'Latest',
  readFull: 'Read the full note',
  fullNoteHref: `${siteConfig.urls.docs}/changelog`,
  empty: 'Nothing here yet.',
  entries: [
    {
      date: '10 Oct 2026',
      tags: ['New', 'Improved'],
      title: 'Website builder, Stock and Profit',
      body: 'Click any text to edit it, 20 new sections and version history. A new Stock menu with suppliers and purchase orders. Profit on every order, and short links that count clicks and orders.',
      screen: {
        src: '/images/screen-stock.png',
        alt: 'The new Stock menu with inventory levels',
        width: 805,
        height: 465,
        url: `${domain}/admin/stock`,
      },
    },
    {
      date: '1 Oct 2026',
      tags: ['New'],
      title: 'Download your data, or delete your store',
      body: 'A full copy of everything your store holds as one zip, and a way for the owner to close the store for good. Plus fair sharing, so one store’s big import never slows another.',
    },
    {
      date: '28 Sep 2026',
      tags: ['New'],
      title: 'More ways for customers to sign in',
      body: 'Google with One Tap, Apple, Facebook and Truecaller, sign-in links by email, passkeys and “Remember this device”.',
      screen: {
        src: '/images/screen-signin.png',
        alt: 'The customer sign-in page',
        width: 805,
        height: 465,
        url: `${domain}/sign-in`,
      },
    },
    {
      date: '27 Sep 2026',
      tags: ['New', 'Improved', 'Fixed'],
      title: 'Privacy, GST settings and Hindi',
      body: 'A cookie banner and consent per channel, Taxes & GST settings, the admin in हिन्दी, the EMI & pay later app, the finished Cashfree connector, and faster worker restarts in development.',
    },
    {
      date: '26 Sep 2026',
      tags: ['New'],
      title: 'Merchant onboarding',
      body: 'A guided first run that sets up your store step by step.',
      screen: {
        src: '/images/screen-signup.png',
        alt: 'The merchant sign-up page',
        width: 805,
        height: 465,
        url: `${domain}/sign-up`,
      },
    },
  ] satisfies readonly ChangelogEntry[],
}
