'use client'

import { ModeToggle } from '@commerce/ui/global/mode-toggle'
import { Separator } from '@commerce/ui/shadcn/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@commerce/ui/shadcn/sidebar'
import { Toaster } from '@commerce/ui/shadcn/sonner'
import { Frame } from '@shopify/polaris'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { isShadcnRoute, layoutContent } from '@/data/layout'
import { AdminSidebar } from './admin-sidebar'

type StoreOption = { id: string; name: string; slug: string }

type AdminFrameProps = {
  children: ReactNode
  user: { name: string; email: string }
  stores: StoreOption[]
  activeStoreId: string | null
  storeName: string | null
}

/**
 * Shell = shadcn sidebar + page content. Pages rebuilt on shadcn render bare;
 * the rest still sit inside the Polaris Frame (Toast + ContextualSaveBar
 * context) until their migration PR lands — see SHADCN_ROUTES.
 */
export function AdminFrame({ children, user, stores, activeStoreId, storeName }: AdminFrameProps) {
  const pathname = usePathname()
  const migrated = isShadcnRoute(pathname)

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AdminSidebar user={user} stores={stores} activeStoreId={activeStoreId} />
      <SidebarInset className="min-h-0 overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm text-muted-foreground">
            {storeName ?? layoutContent.noStore}
          </span>
          <div className="ml-auto">
            <ModeToggle />
          </div>
        </header>
        {migrated ? (
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        ) : (
          <div className="polaris-scope min-h-0 flex-1 overflow-y-auto">
            <Frame>{children}</Frame>
          </div>
        )}
        <Toaster position="bottom-center" />
      </SidebarInset>
    </SidebarProvider>
  )
}
