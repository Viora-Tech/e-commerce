'use client'

import { SidebarInset, SidebarProvider } from '@commerce/ui/shadcn/sidebar'
import { Toaster } from '@commerce/ui/shadcn/sonner'
import { usePathname } from 'next/navigation'
import type { CSSProperties, ReactNode } from 'react'
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
}: AdminFrameProps) {
  // Hooks
  const pathname = usePathname()

  // Render logic
  const title = pageTitleFor(pathname)
  const ownHeading = hasOwnHeading(pathname)

  return (
    <SidebarProvider
      className="h-svh overflow-hidden"
      style={{ '--sidebar-width': SIDEBAR_WIDTH } as CSSProperties}
    >
      <AdminSidebar
        user={user}
        stores={stores}
        activeStoreId={activeStoreId}
        storefrontUrl={storefrontUrl}
        apps={apps}
      />
      <SidebarInset className="min-h-0 overflow-hidden bg-sidebar md:pt-2">
        {/* The white content panel in the grey shell (Saleor Dashboard): one curve at its
            top-left where it meets the rail, hairlines on the top and left, and flush with the
            right and bottom edges of the window. */}
        <main
          id="main"
          className="no-scrollbar min-h-0 flex-1 overflow-y-auto border-border bg-card md:rounded-tl-xl md:border-t md:border-l"
        >
          <TopBar user={user} />
          {ownHeading ? null : (
            <div className="border-border border-b px-4 py-5 md:px-6">
              <h1 className="text-page-title text-ink-strong">{title}</h1>
            </div>
          )}
          {children}
        </main>
        <Toaster />
        <PaletteHost />
      </SidebarInset>
    </SidebarProvider>
  )
}
