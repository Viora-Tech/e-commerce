import { SidebarInset, SidebarProvider } from '@commerce/ui/shadcn/sidebar'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { AdminNavbar } from '@/components/admin-navbar'
import { AdminSidebar } from '@/components/admin-sidebar'
import { auth, getSession } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const orgs = await auth().api.listOrganizations({ headers: await headers() })
  const activeId =
    (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null
  const active = orgs.find((o) => o.id === activeId) ?? null

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AdminSidebar
        user={{ name: session.user.name, email: session.user.email }}
        stores={orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug }))}
        activeStoreId={active?.id ?? null}
      />
      <SidebarInset className="min-h-0 overflow-hidden">
        <AdminNavbar storeName={active?.name ?? null} />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
