import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { AdminFrame } from '@/components/admin-frame'
import { auth, getSession } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const orgs = await auth().api.listOrganizations({ headers: await headers() })
  const activeId =
    (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null

  return (
    <AdminFrame
      user={{ name: session.user.name, email: session.user.email }}
      stores={orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug }))}
      activeStoreId={orgs.some((o) => o.id === activeId) ? activeId : null}
    >
      {children}
    </AdminFrame>
  )
}
