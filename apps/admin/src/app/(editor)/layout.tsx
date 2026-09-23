import { Toaster } from '@commerce/ui/shadcn/sonner'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import AccentStyle from '@/components/layout/accent-style'
import { getSession } from '@/lib/auth'

/**
 * Full-screen tools that bring their own chrome (the theme editor), outside the
 * admin shell's sidebar and top bar. Same session gate as the shell.
 */
export default async function EditorLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  const activeOrganizationId =
    (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null

  return (
    <>
      <AccentStyle organizationId={activeOrganizationId} />
      {children}
      <Toaster />
    </>
  )
}
