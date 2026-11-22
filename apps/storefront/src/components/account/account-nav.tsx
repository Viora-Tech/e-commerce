'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import CheckoutIcon, { type CheckoutIconName } from '@/components/checkout/checkout-icon'
import { accountContent } from '@/data/account'
import { loyaltyAccountContent } from '@/data/loyalty'
import { signOutAction } from '@/lib/account-actions'

type AccountNavProps = {
  /** Email, or the mobile number for a phone-only account: which account this is. */
  email: string
  name: string | null
  /** The store has the Loyalty points app: show the Points section after Store credit. */
  showPoints?: boolean | undefined
}

const copy = accountContent.nav

type NavLink = {
  href: string
  label: string
  icon: CheckoutIconName
  match: (p: string) => boolean
}

const LINKS: NavLink[] = [
  {
    href: '/account',
    label: copy.orders,
    icon: 'bag',
    match: (p) => p === '/account' || p.startsWith('/account/orders'),
  },
  {
    href: '/account/addresses',
    label: copy.addresses,
    icon: 'pin',
    match: (p) => p.startsWith('/account/addresses'),
  },
  {
    href: '/account/profile',
    label: copy.profile,
    icon: 'user',
    match: (p) => p.startsWith('/account/profile'),
  },
  {
    href: '/account/store-credit',
    label: copy.storeCredit,
    icon: 'gift',
    match: (p) => p.startsWith('/account/store-credit'),
  },
  {
    href: '/account/points',
    label: loyaltyAccountContent.nav,
    icon: 'tag',
    match: (p) => p.startsWith('/account/points'),
  },
  {
    href: '/account/privacy',
    label: copy.privacy,
    icon: 'shield',
    match: (p) => p.startsWith('/account/privacy'),
  },
]

/*
 * A phone shows the sections as a row of pills that scrolls sideways (the current one filled
 * with the store's button colour); from `lg` they stack as a sidebar with the current one lit
 * on the card surface, as the checkout's picked rows. Every row is a full 2.75rem tap.
 */
const LINK =
  'inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-full border px-4 text-[0.875rem]! font-medium! no-underline outline-none touch-manipulation transition-colors duration-150 focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] motion-reduce:transition-none lg:w-full lg:rounded-ck lg:border-transparent lg:px-3'

/** A section not open: a quiet pill on a phone, a plain row in the sidebar. */
const IDLE = `${LINK} border-ck-line bg-ck-bg text-ck-muted! hover:text-ck-ink! lg:bg-transparent`

/** The open section: filled with the button colour on a phone, lit on the card in the sidebar. */
const ACTIVE = `${LINK} border-ck-button bg-ck-button text-ck-button-ink! lg:bg-ck-bg lg:text-ck-ink! lg:[box-shadow:var(--ck-section-shadow)]`

/**
 * The account's sections (Figma Pages · Account, 705:114056): who is signed in, then Orders,
 * Addresses, Profile, Store credit, Points (Loyalty points app), Your data and Sign out.
 */
export default function AccountNav({ email, name, showPoints = false }: AccountNavProps) {
  // Hooks
  const pathname = usePathname()

  // Render logic
  const links = showPoints ? LINKS : LINKS.filter((l) => l.href !== '/account/points')

  return (
    <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-6 lg:gap-5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-[0.75rem] font-medium text-ck-muted">{copy.signedInAs}</p>
        <p className="truncate text-[0.9375rem] font-semibold text-ck-ink">{name || email}</p>
        {name ? <p className="truncate text-[0.8125rem] text-ck-muted">{email}</p> : null}
      </div>
      <nav
        className="-mb-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:mb-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0"
        aria-label={accountContent.title}
      >
        {links.map((l) => {
          const active = l.match(pathname)
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? 'page' : undefined}
              className={active ? ACTIVE : IDLE}
            >
              <CheckoutIcon name={l.icon} className="size-4 shrink-0" />
              {l.label}
            </Link>
          )
        })}
        <form
          action={signOutAction}
          className="shrink-0 lg:mt-2 lg:border-t lg:border-ck-line lg:pt-2"
        >
          {/* `!` on the box: the theme's base rule strips a button's border and background. */}
          <button
            type="submit"
            className={`${IDLE} border! border-ck-line! bg-ck-bg! lg:border-transparent! lg:bg-transparent!`}
          >
            <CheckoutIcon name="back" className="size-4 shrink-0" />
            {copy.signOut}
          </button>
        </form>
      </nav>
    </aside>
  )
}
