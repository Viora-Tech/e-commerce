'use client'

import { SidebarInset, SidebarProvider } from '@commerce/ui/shadcn/sidebar'
import type { CSSProperties, ReactNode } from 'react'
import PortalSidebar from './portal-sidebar'
import SiteHeader from './site-header'

type PortalShellProps = {
  store: { name: string; iconUrl: string | null; email: string | null }
  affiliate: { name: string; email: string | null; status: string }
  /** Where the portal's links start: `''` on its own host, `/affiliate` on a store domain. */
  base: string
  /** The store's own address, for "Visit the store". */
  storeOrigin: string
  children: ReactNode
}

/** dashboard-01's widths: a 16rem sidebar and a 3rem header. */
const SHELL = { '--sidebar-width': '16rem', '--header-height': '3rem' } as CSSProperties

/**
 * The portal's frame, laid out like shadcn's dashboard-01: an inset sidebar (sidebar-07, the
 * affiliate at the bottom) and the page in a panel with its SiteHeader. On a phone the sidebar
 * is a sheet behind the header's button.
 */
export default function PortalShell({
  store,
  affiliate,
  base,
  storeOrigin,
  children,
}: PortalShellProps) {
  // Render logic
  return (
    <SidebarProvider style={SHELL}>
      <PortalSidebar store={store} affiliate={affiliate} base={base} storeOrigin={storeOrigin} />
      <SidebarInset className="min-w-0">
        <SiteHeader base={base} supportEmail={store.email} />
        <div className="@container/main flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
