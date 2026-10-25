import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import RoleEditor from '@/components/staff/role-editor'
import { staffContent } from '@/data/staff'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: staffContent.roleForm.editTitle }

type Props = { params: Promise<{ id: string }> }

export default async function Page({ params }: Props) {
  const { id } = await params
  const context = await serverContext()
  const roles = await call(appRouter.staff.roles, undefined, { context })
  const role = roles.find((r) => r.id === id)
  if (!role) notFound()

  return <RoleEditor key={role.id} initial={role} />
}
