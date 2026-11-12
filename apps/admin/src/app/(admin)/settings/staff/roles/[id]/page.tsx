import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { roleEditorKey } from '@/components/staff/role-access'
import RoleEditor from '@/components/staff/role-editor'
import { staffContent } from '@/data/staff'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: staffContent.roleForm.editTitle }

/** Always read the role as saved now, never a cached render (#1623). */
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function Page({ params }: Props) {
  const { id } = await params
  const context = await serverContext()
  const roles = await call(appRouter.staff.roles, undefined, { context })
  const role = roles.find((r) => r.id === id)
  if (!role) notFound()

  // Keyed by what is saved: a fresh read that differs mounts a fresh form (#1623).
  return <RoleEditor key={roleEditorKey(role)} initial={role} />
}
