'use client'

import { SidebarInset, SidebarProvider } from '@commerce/ui/shadcn/sidebar'
import { Toaster } from '@commerce/ui/shadcn/sonner'
import { usePathname } from 'next/navigation'
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { hasOwnHeading, pageTitleFor } from '@/data/layout'
import AdminSidebar from './admin-sidebar'
import PaletteHost from './layout/palette-host'
import TopBar from './layout/top-bar'

type StoreOption = { id: string; name: string; slug: string }

type AdminFrameProps = {
  children: ReactNode
  user: { name: string; email: string }
  stores: StoreOption[]
  activeStoreId: string | null
  storefrontUrl: string
  /** Installed apps with their own pages, listed under Apps in the sidebar. */
  apps: { id: string; name: string; icon: string | null }[]
  /** The live theme's logo, if the store has uploaded one; else the sidebar shows a monogram. */
  logoUrl: string | null
}

const SIDEBAR_WIDTH = '16rem'

/** Shell = grey rail + the white scrolling content panel with its slim header. */
export default function AdminFrame({
  children,
  user,
  stores,
  activeStoreId,
  storefrontUrl,
  apps,
  logoUrl,
}: AdminFrameProps) {
  // Hooks
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
  const title = pageTitleFor(pathname)
  const ownHeading = hasOwnHeading(pathname)

  return (
    <SidebarProvider
      className="h-svh overflow-hidden"
      style={{ '--sidebar-width': SIDEBAR_WIDTH } as CSSProperties}
    >
      <AdminSidebar stores={stores} activeStoreId={activeStoreId} apps={apps} logoUrl={logoUrl} />
      <SidebarInset className="min-h-0 overflow-hidden bg-sidebar">
        {/* Search, notifications, theme and account sit in the grey band above the page, so the
            white panel below reads as the page itself. */}
        <TopBar user={user} storefrontUrl={storefrontUrl} />
        {/* The white content panel in the grey shell (Saleor Dashboard): one curve at its
            top-left where it meets the rail, hairlines on the top and left, and flush with the
            right and bottom edges of the window. */}
        <main
          ref={mainRef}
          id="main"
          data-scrolled={scrolled || undefined}
          className="group/main no-scrollbar min-h-0 flex-1 overflow-y-auto border-border bg-card md:rounded-tl-xl md:border-t md:border-l"
        >
          {ownHeading ? null : (
            <div className="sticky top-0 z-10 border-border border-b bg-card px-4 py-5 transition-shadow duration-200 group-data-[scrolled]/main:shadow-[0_6px_16px_-10px_hsl(211_42%_16%/0.25)] md:px-6">
              <h1 className="text-page-title text-ink-strong">{title}</h1>
            </div>
          )}
          {/* The page-enter fade lives once, in the (admin) template.tsx, not here. */}
          {children}
        </main>
        <Toaster />
        <PaletteHost />
      </SidebarInset>
    </SidebarProvider>
  )
}
