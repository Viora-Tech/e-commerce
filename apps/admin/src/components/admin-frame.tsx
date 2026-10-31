'use client'

import { siteConfig } from '@commerce/config/site'
import { SidebarInset, SidebarProvider } from '@commerce/ui/shadcn/sidebar'
import { Toaster } from '@commerce/ui/shadcn/sonner'
import { usePathname } from 'next/navigation'
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { hasOwnHeading, layoutContent, pagePrefixFor, pageTitleFor } from '@/data/layout'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { pageName } from '@/lib/page-names'
import { routes } from '@/lib/routes'
import AdminSidebar from './admin-sidebar'
import AssistantHost from './assistant/assistant-host'
import BugReportHost from './bug-report/bug-report-host'
import PaletteHost from './layout/palette-host'
import SidebarShortcutGuard from './layout/sidebar-shortcut-guard'
import type { SidebarUsage } from './layout/sidebar-usage-card'
import TopBar from './layout/top-bar'

type StoreOption = { id: string; name: string; slug: string }

type AdminFrameProps = {
  children: ReactNode
  user: { name: string; email: string; image: string | null }
  stores: StoreOption[]
  activeStoreId: string | null
  storefrontUrl: string
  /** Installed apps, listed under Apps in the sidebar; `href` is the app page or its settings. */
  apps: { id: string; name: string; icon: string | null; href: string }[]
  /** Installed sales channel apps (Inbox), listed under Sales channels. */
  channels?: string[] | undefined
  /** The live theme's logo, if the store has uploaded one; else the sidebar shows a monogram. */
  logoUrl: string | null
  /** The test server's "Report a bug" button and menu item (`BUG_REPORTS_ENABLED`). */
  bugReports: boolean
  /** Count pills on sidebar rows, by the row's href (Orders: orders waiting to ship). */
  navCounts: Record<string, number>
  /** "Orders this month · 142 of 200" above the user row; left out when unknown. */
  usage?: SidebarUsage | undefined
}

const SIDEBAR_WIDTH = '16rem'
/** Inside Settings the main menu's icon column (2.75rem) sits beside the Settings menu. */
const SETTINGS_SIDEBAR_WIDTH = '18.75rem'

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
  channels,
  logoUrl,
  bugReports,
  navCounts,
  usage,
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
  const settingsHome = routes.settings.home()
  const inSettings = pathname === settingsHome || pathname.startsWith(`${settingsHome}/`)

  return (
    <SidebarProvider
      className="h-svh overflow-hidden [--sidebar-ms:320ms] in-data-[sidebar-instant]:[--sidebar-ms:0ms] motion-reduce:[--sidebar-ms:0ms] [&_[data-slot=sidebar-container]]:duration-(--sidebar-ms) [&_[data-slot=sidebar-container]]:ease-drawer [&_[data-slot=sidebar-gap]]:duration-(--sidebar-ms) [&_[data-slot=sidebar-gap]]:ease-drawer"
      style={
        { '--sidebar-width': inSettings ? SETTINGS_SIDEBAR_WIDTH : SIDEBAR_WIDTH } as CSSProperties
      }
    >
      <SidebarShortcutGuard />
      <AdminSidebar
        stores={stores}
        activeStoreId={activeStoreId}
        apps={apps}
        channels={channels}
        logoUrl={logoUrl}
        user={user}
        storefrontUrl={storefrontUrl}
        bugReports={bugReports}
        navCounts={navCounts}
        usage={usage}
      />
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden bg-sidebar">
        {/* Search, Ask AI, notifications, theme and account sit on the shell colour above the
            panel, so the panel below reads as the page itself. */}
        <TopBar
          user={user}
          storefrontUrl={storefrontUrl}
          bugReports={bugReports}
          storeName={stores.find((s) => s.id === activeStoreId)?.name ?? null}
          scrolled={scrolled}
        />
        {/* The content panel (shadcn SidebarInset): runs to the right and bottom window edges
            with no margin; rounded on the top-left, top-right and bottom-left corners (owner,
            2026-10-17), a hairline where it meets the top bar and the sidebar. */}
        <main
          ref={mainRef}
          id="main"
          data-scrolled={scrolled || undefined}
          className="group/main no-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto bg-background md:rounded-tl-lg md:rounded-tr-lg md:rounded-bl-lg md:border-panel-border md:border-t md:border-l"
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
        {bugReports ? <BugReportHost /> : null}
      </SidebarInset>
      {/* The AI panel docks to the right of everything, top bar included, full window height. */}
      <AssistantHost storeId={activeStoreId} />
    </SidebarProvider>
  )
}
