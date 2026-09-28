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

/** Account heading and tabs; the tabs scroll sideways on a phone. */
export default function AccountNav({ email, name }: AccountNavProps) {
  // Hooks
  const pathname = usePathname()

  // Render logic
  return (
    <div className="mb-8 flex flex-col gap-5 border-b border-line md:mb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="h2">{accountContent.title}</h1>
          <p className="truncate text-small text-muted">{name ? `${name}, ${email}` : email}</p>
        </div>
        <form action={signOutAction}>
          <button type="submit" className="btn btn--secondary btn--small">
            {copy.signOut}
          </button>
        </form>
      </div>
      <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label={accountContent.title}>
        {LINKS.map((l) => {
          const active = l.match(pathname)
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 border-b-2 pb-3 text-body font-medium ${active ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}
            >
              {l.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
