import type { ReactNode } from 'react'
import PortalShell from '@/components/affiliate-portal/portal-shell'
import { portalBase, portalStore, portalViewer } from '@/lib/affiliate-portal'

type Props = { children: ReactNode; params: Promise<{ storeId: string }> }

/**
 * The signed-in portal's frame (sidebar and top bar). Anyone else gets the page bare: each page
 * sends them to sign in or to the signup page (`requireAffiliate`).
 */
export default async function PortalPagesLayout({ children, params }: Props) {
  // Hooks
  const { storeId } = await params
  const [viewer, store, base] = await Promise.all([
    portalViewer(storeId),
    portalStore(storeId),
    portalBase(),
  ])

  // Early returns
  const a = viewer.affiliate
  if (!viewer.me || a?.status !== 'approved') return children

  // Render logic
  return (
    <PortalShell
      store={store}
      affiliate={{
        name: a.name || viewer.me.name || '',
        email: viewer.me.email ?? a.email,
        status: a.status,
      }}
      base={base}
      storeOrigin={store.origin}
    >
      {children}
    </PortalShell>
  )
}
