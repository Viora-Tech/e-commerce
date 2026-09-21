'use client'

import { SidebarInset, SidebarProvider } from '@commerce/ui/shadcn/sidebar'
import { Toaster } from '@commerce/ui/shadcn/sonner'
import { usePathname } from 'next/navigation'
import type { CSSProperties, ReactNode } from 'react'
import { pageTitleFor } from '@/data/layout'
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

/** Shell = kit sidebar + top bar + scrolling page content. */
export function AdminFrame({
  children,
  user,
  stores,
  activeStoreId,
  storefrontUrl,
}: AdminFrameProps) {
  const pathname = usePathname()

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
        <TopBar title={pageTitleFor(pathname)} user={user} />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        <Toaster position="bottom-center" />
      </SidebarInset>
    </SidebarProvider>
  )
}
