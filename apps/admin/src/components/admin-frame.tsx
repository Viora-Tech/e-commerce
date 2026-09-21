'use client'

import { SidebarInset, SidebarProvider } from '@commerce/ui/shadcn/sidebar'
import { Toaster } from '@commerce/ui/shadcn/sonner'
import { Frame } from '@shopify/polaris'
import { usePathname } from 'next/navigation'
import type { CSSProperties, ReactNode } from 'react'
import { hasOwnHeading, isShadcnRoute, pageTitleFor } from '@/data/layout'
import { AdminSidebar } from './admin-sidebar'
import { TopBar } from './layout/top-bar'

type StoreOption = { id: string; name: string; slug: string }

type AdminFrameProps = {
  children: ReactNode
  user: { name: string; email: string }
  stores: StoreOption[]
  activeStoreId: string | null
  storefrontUrl: string
}

const SIDEBAR_WIDTH = '260px'

/**
 * Shell = kit sidebar + top bar + page content. Pages rebuilt on shadcn render
 * bare; the rest still sit inside the Polaris Frame (Toast + ContextualSaveBar
 * context) until their migration PR lands; see POLARIS_ROUTES.
 */
export function AdminFrame({
  children,
  user,
  stores,
  activeStoreId,
  storefrontUrl,
}: AdminFrameProps) {
  const pathname = usePathname()
  const migrated = isShadcnRoute(pathname)

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
      />
      <SidebarInset className="min-h-0 overflow-hidden">
        <TopBar title={pageTitleFor(pathname)} heading={!hasOwnHeading(pathname)} user={user} />
        {migrated ? (
          <main id="main" className="min-h-0 flex-1 overflow-y-auto">
            {children}
          </main>
        ) : (
          <div id="main" className="polaris-scope min-h-0 flex-1 overflow-y-auto">
            <Frame>{children}</Frame>
          </div>
        )}
        <Toaster position="bottom-center" />
      </SidebarInset>
    </SidebarProvider>
  )
}
