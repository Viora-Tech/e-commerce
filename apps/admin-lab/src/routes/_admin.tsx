import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import AdminFrame from '@/components/admin-frame'
import ListPageSkeleton from '@/components/layout/list-page-skeleton'
import { appEntryHref } from '@/lib/apps-gallery'
import { routes } from '@/lib/routes'
import { orpc } from '~/query'

type Org = { id: string; name: string; slug: string }

/** Better Auth's own endpoint, the one `listStores()` calls on the admin's server. */
async function listStores(): Promise<Org[]> {
  const res = await fetch('/api/auth/organization/list', { credentials: 'include' })
  if (!res.ok) return []
  return res.json()
}

/**
 * The (admin) layout as a client route: the same AdminFrame, fed by the API instead of a
 * server component. The session check moves from the server (`redirect(routes.login())`) to
 * here: a 401 from `me` sends the member to the admin's sign-in page.
 */
export const Route = createFileRoute('/_admin')({
  // The shell's reads start with the page's, not after the layout first renders.
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery({ ...orpc.me.queryOptions(), staleTime: 5 * 60_000 })
    void queryClient.prefetchQuery({ queryKey: ['stores'], queryFn: listStores })
    void queryClient.prefetchQuery(orpc.store.shell.queryOptions())
    void queryClient.prefetchQuery(orpc.store.origin.queryOptions())
  },
  component: AdminLayout,
  pendingComponent: ListPageSkeleton,
})

function AdminLayout() {
  const me = useQuery({ ...orpc.me.queryOptions(), staleTime: 5 * 60_000, retry: false })
  const stores = useQuery({ queryKey: ['stores'], queryFn: listStores, staleTime: 5 * 60_000 })
  const shell = useQuery(orpc.store.shell.queryOptions())
  const origin = useQuery(orpc.store.origin.queryOptions())

  if (me.isError) {
    // Signing in stays on the admin (its cookie is shared with this origin on localhost).
    const admin = import.meta.env.VITE_ADMIN_URL ?? 'http://localhost:3200'
    if (typeof window !== 'undefined') window.location.href = `${admin}${routes.login()}`
    return null
  }
  if (!me.data) return <ListPageSkeleton />

  const session = me.data
  const activeId = session.activeOrganizationId ?? null
  const s = shell.data
  const installed = (s?.apps ?? []).filter((a) => a.installed && a.id !== 'core')
  const channels = installed.filter((a) => a.admin.salesChannel).map((a) => a.id)
  const appLinks = installed
    .filter((a) => !a.admin.salesChannel)
    .map((a) => ({ id: a.id, name: a.name, icon: a.admin.icon, href: appEntryHref(a) }))
  const navCounts: Record<string, number> = s?.toShip
    ? { [routes.orders.list()]: s.toShip, [routes.orders.shipments()]: s.toShip }
    : {}

  return (
    <AdminFrame
      user={{
        name: session.user.name,
        email: session.user.email,
        image: (session.user as { image?: string | null }).image ?? null,
      }}
      stores={(stores.data ?? []).map((o) => ({ id: o.id, name: o.name, slug: o.slug }))}
      activeStoreId={activeId}
      storefrontUrl={origin.data ?? ''}
      apps={appLinks}
      logoUrl={s?.logo ?? null}
      channels={channels}
      navCounts={navCounts}
      bugReports={false}
    >
      <Outlet />
    </AdminFrame>
  )
}
