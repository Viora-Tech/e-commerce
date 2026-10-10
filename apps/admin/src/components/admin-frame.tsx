'use client'

import { siteConfig } from '@commerce/config/site'
import { SidebarInset, SidebarProvider } from '@commerce/ui/shadcn/sidebar'
import { Toaster } from '@commerce/ui/shadcn/sonner'
import { usePathname } from 'next/navigation'
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { hasOwnHeading, layoutContent, pagePrefixFor, pageTitleFor } from '@/data/layout'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { pageName } from '@/lib/page-names'
import AdminSidebar from './admin-sidebar'
import AssistantHost from './assistant/assistant-host'
import BugReportHost from './bug-report/bug-report-host'
import PaletteHost from './layout/palette-host'
import TopBar from './layout/top-bar'

type StoreOption = { id: string; name: string; slug: string }

type AdminFrameProps = {
  children: ReactNode
  user: { name: string; email: string; image: string | null }
  stores: StoreOption[]
  activeStoreId: string | null
  storefrontUrl: string
  /** Installed apps with their own pages, listed under Apps in the sidebar. */
  apps: { id: string; name: string; icon: string | null }[]
  /** The live theme's logo, if the store has uploaded one; else the sidebar shows a monogram. */
  logoUrl: string | null
  /** The test server's "Report a bug" button and menu item (`BUG_REPORTS_ENABLED`). */
  bugReports: boolean
}

const SIDEBAR_WIDTH = '16rem'

/**
 * Shell (Figma Home frame): the sidebar and the top bar share the shell colour; the content
 * panel is a rounded inset with a hairline, on the panel colour, and scrolls on its own.
 */
export default function AdminFrame({
  children,
  user,
  stores,
  activeStoreId,
  storefrontUrl,
  apps,
  logoUrl,
  bugReports,
}: AdminFrameProps) {
  // Hooks
  const layoutCopy = useCopy(layoutContent)
  const locale = useLocale()
  const pathname = usePathname()
  const mainRef = useRef<HTMLElement>(null)
  const [scrolled, setScrolled] = useState(false)
  // Sticky page headers lift off the page once content scrolls under them.
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const onScroll = () => setScrolled(el.scrollTop > 4)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Render logic
  const prefix = pagePrefixFor(pathname)
  const title = prefix ? pageName(prefix, pageTitleFor(pathname), locale) : layoutCopy.dashboard
  const ownHeading = hasOwnHeading(pathname)

  return (
    <SidebarProvider
      className="h-svh overflow-hidden"
      style={{ '--sidebar-width': SIDEBAR_WIDTH } as CSSProperties}
    >
      <AdminSidebar
        stores={stores}
        activeStoreId={activeStoreId}
        apps={apps}
        logoUrl={logoUrl}
        user={user}
        storefrontUrl={storefrontUrl}
        bugReports={bugReports}
      />
      <SidebarInset className="min-h-0 overflow-hidden bg-sidebar">
        {/* Search, Ask AI, notifications, theme and account sit on the shell colour above the
            panel, so the panel below reads as the page itself. */}
        <TopBar
          user={user}
          storefrontUrl={storefrontUrl}
          bugReports={bugReports}
          scrolled={scrolled}
        />
        {/* The content panel: radius 16 with a hairline, inset from the window edges. */}
        <main
          ref={mainRef}
          id="main"
          data-scrolled={scrolled || undefined}
          className="group/main no-scrollbar min-h-0 flex-1 overflow-y-auto border-panel-border bg-background md:mr-2 md:mb-2 md:rounded-xl md:border"
        >
          {ownHeading ? null : (
            <div className="sticky top-0 z-10 border-panel-border border-b bg-background px-4 py-5 transition-shadow duration-200 group-data-[scrolled]/main:shadow-[0_6px_16px_-10px_var(--shadow-14)] md:px-6">
              <h1 className="text-page-title text-ink-strong">{title}</h1>
            </div>
          )}
          {/* The page-enter fade lives once, in the (admin) template.tsx, not here. */}
          {children}
        </main>
        <Toaster duration={siteConfig.ui.toastMs.default} />
        <PaletteHost />
        <AssistantHost storeId={activeStoreId} />
        {bugReports ? <BugReportHost /> : null}
      </SidebarInset>
    </SidebarProvider>
  )
}
