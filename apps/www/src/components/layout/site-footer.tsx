import Link from 'next/link'
import { siteContent } from '@/data/site'
import BrandMark from '../common/brand-mark'
import PageContainer from '../common/page-container'
import CookiePreferencesButton from '../consent/cookie-preferences-button'

const LINK_CLASS = 'text-sm text-muted-foreground transition-colors hover:text-foreground'

export default function SiteFooter() {
  return (
    <footer className="print:hidden border-t border-border bg-background">
      <PageContainer className="flex flex-col gap-12 py-14">
        <div className="grid gap-10 md:grid-cols-[1fr_auto] md:gap-24">
          <div className="flex flex-col gap-4">
            <BrandMark />
            <p className="text-sm text-muted-foreground">{siteContent.tagline}</p>
            <a href={`mailto:${siteContent.supportEmail}`} className={LINK_CLASS}>
              {siteContent.supportEmail}
            </a>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-10 sm:grid-cols-4">
            {siteContent.footerColumns.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <p className="mb-4 text-sm font-medium text-foreground">{column.title}</p>
                <ul className="flex flex-col gap-3">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      {link.href.startsWith('/') ? (
                        <Link href={link.href} className={LINK_CLASS}>
                          {link.label}
                        </Link>
                      ) : (
                        <a href={link.href} className={LINK_CLASS}>
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>
            © {siteContent.brand} · {siteContent.madeIn}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <CookiePreferencesButton />
            {siteContent.social.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </PageContainer>
    </footer>
  )
}
