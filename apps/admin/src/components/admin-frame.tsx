'use client'

import { ModeToggle } from '@commerce/ui/global/mode-toggle'
import { Separator } from '@commerce/ui/shadcn/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@commerce/ui/shadcn/sidebar'
import { Frame } from '@shopify/polaris'
import type { ReactNode } from 'react'
import { AdminSidebar } from './admin-sidebar'

type StoreOption = { id: string; name: string; slug: string }

/**
 * Shell = shadcn sidebar (CodeHelp style) + Polaris page content (Shopify style).
 * Polaris Frame wraps only the content so Toast and ContextualSaveBar have their
 * context without Polaris owning the navigation.
 */
export function AdminFrame({
  children,
  user,
  stores,
  activeStoreId,
  storeName,
}: {
  children: ReactNode
  user: { name: string; email: string }
  stores: StoreOption[]
  activeStoreId: string | null
  storeName: string | null
}) {
  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AdminSidebar user={user} stores={stores} activeStoreId={activeStoreId} />
      <SidebarInset className="min-h-0 overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm text-muted-foreground">{storeName ?? 'No store selected'}</span>
          <div className="ml-auto">
            <ModeToggle />
          </div>
        </header>
        <div className="polaris-scope min-h-0 flex-1 overflow-y-auto">
          <Frame>{children}</Frame>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
