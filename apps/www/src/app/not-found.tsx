import { siteConfig } from '@commerce/config/site'
import {
  BadgePercent,
  FileText_ as FileText,
  Home,
  LayoutGrid,
  MapPinLineIcon,
  MessageSquare,
  Search,
} from '@commerce/ui/icons'
import { buttonVariants } from '@commerce/ui/shadcn/button'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import PageContainer from '@/components/common/page-container'
import SiteShell from '@/components/layout/site-shell'

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false },
}

const POPULAR = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Pricing', href: '/pricing', icon: BadgePercent },
  { label: 'Features', href: '/features', icon: LayoutGrid },
  { label: 'Docs', href: siteConfig.urls.docs, icon: FileText },
  { label: 'Contact', href: '/contact', icon: MessageSquare },
]

export default function NotFound() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden">
        <PageContainer className="flex flex-col items-center gap-6 pt-20 text-center md:pt-28">
          <p className="text-eyebrow">Error 404</p>
          <h1 className="text-6xl font-semibold text-balance text-foreground md:text-8xl md:tracking-tighter">
            Lost somewhere
            <br />
            over India.
          </h1>
          <p className="max-w-xl text-lead text-pretty text-muted-foreground">
            This page moved, or the link has a typo. Search, or jump to a popular page.
          </p>
          <a
            href={siteConfig.urls.docs}
            className="glass-panel flex h-11 w-full max-w-md items-center gap-3 rounded-full px-4 text-sm text-muted-foreground"
          >
            <Search aria-hidden className="size-4" />
            Search pages and docs
          </a>
          <ul className="flex flex-wrap justify-center gap-2">
            {POPULAR.map((item) => (
              <li key={item.label}>
                {item.href.startsWith('/') ? (
                  <Link
                    href={item.href}
                    className={buttonVariants({
                      variant: 'outline',
                      size: 'sm',
                      className: 'rounded-full',
                    })}
                  >
                    <item.icon aria-hidden />
                    {item.label}
                  </Link>
                ) : (
                  <a
                    href={item.href}
                    className={buttonVariants({
                      variant: 'outline',
                      size: 'sm',
                      className: 'rounded-full',
                    })}
                  >
                    <item.icon aria-hidden />
                    {item.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
          <Link href="/" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
            Back to home
          </Link>
        </PageContainer>
        <div
          aria-hidden
          className="pointer-events-none relative mt-16 h-60 overflow-hidden md:h-[28rem]"
        >
          <Image
            src="/images/globe.png"
            alt=""
            width={1056}
            height={480}
            className="absolute bottom-0 left-1/2 w-[130%] max-w-none -translate-x-1/2 md:w-[66rem]"
          />
          <p className="glass-popover absolute top-8 left-1/2 ml-16 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-foreground md:top-12">
            <MapPinLineIcon className="size-3.5" />
            Page not found · somewhere near here
          </p>
        </div>
      </section>
    </SiteShell>
  )
}
