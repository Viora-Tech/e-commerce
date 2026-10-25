import type { Metadata } from 'next'
import RoleEditor from '@/components/staff/role-editor'
import { staffContent } from '@/data/staff'

export const metadata: Metadata = { title: staffContent.roleForm.createTitle }

export default function Page() {
  return <RoleEditor initial={null} />
}
