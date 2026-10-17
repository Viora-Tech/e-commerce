import Link from 'next/link'
import { siteContent } from '@/data/site'
import BrandMark from '../common/brand-mark'
import JoinWaitlistButton from '../waitlist/join-waitlist-button'
import MobileNav from './mobile-nav'

const LINK_CLASS =
  'rounded-md px-3 py-2 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50'

export default function SiteNav() {
  return (
    <header className="print:hidden sticky top-4 z-30 mx-auto mt-4 w-full max-w-page px-4 md:px-8">
      <nav
        aria-label="Main"
        className="surface-glass glass-bar flex h-14 items-center justify-between rounded-full pr-2 pl-4"
      >
        <BrandMark />
        <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
          {siteContent.navLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={LINK_CLASS}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1">
          <a
            href={siteContent.signIn.href}
            className="hidden px-3 text-sm font-medium text-foreground md:block"
          >
            {siteContent.signIn.label}
          </a>
          <JoinWaitlistButton size="sm" />
          <MobileNav />
        </div>
      </nav>
    </header>
  )
}
