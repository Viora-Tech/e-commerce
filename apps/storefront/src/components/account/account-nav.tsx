'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { accountContent } from '@/data/account'
import { signOutAction } from '@/lib/account-actions'

type AccountNavProps = {
  /** Email, or the mobile number for a phone-only account: which account this is. */
  email: string
  name: string | null
}

const copy = accountContent.nav

const LINKS = [
  {
    href: '/account',
    label: copy.orders,
    match: (p: string) => p === '/account' || p.startsWith('/account/orders'),
  },
  {
    href: '/account/addresses',
    label: copy.addresses,
    match: (p: string) => p.startsWith('/account/addresses'),
  },
  {
    href: '/account/profile',
    label: copy.profile,
    match: (p: string) => p.startsWith('/account/profile'),
  },
  {
    href: '/account/privacy',
    label: copy.privacy,
    match: (p: string) => p.startsWith('/account/privacy'),
  },
]

/**
 * Figma Pages · Account (705:114056): the sidebar - "Account", who is signed in, then the
 * sections as rows with the current one on the surface and Sign out last. On a phone the
 * rows run sideways above the page.
 */
export default function AccountNav({ email, name }: AccountNavProps) {
  // Hooks
  const pathname = usePathname()

  // Render logic
  return (
    <aside className="account-nav">
      <div className="account-nav__head">
        <p className="account-nav__title">{accountContent.title}</p>
        <p className="account-nav__who">{name ? `${name}, ${email}` : email}</p>
      </div>
      <nav className="account-nav__links" aria-label={accountContent.title}>
        {LINKS.map((l) => {
          const active = l.match(pathname)
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? 'page' : undefined}
              className="account-nav__link"
            >
              {l.label}
            </Link>
          )
        })}
        <form action={signOutAction}>
          <button type="submit" className="account-nav__link account-nav__sign-out">
            {copy.signOut}
          </button>
        </form>
      </nav>
    </aside>
  )
}
