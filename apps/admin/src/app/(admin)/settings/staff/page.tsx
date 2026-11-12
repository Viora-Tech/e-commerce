import type { Metadata } from 'next'
import StaffSettings from '@/components/staff/staff-settings'

export const metadata: Metadata = { title: 'Staff' }

/** The team and roles are read fresh on every visit, never from a cached render (#1623). */
export const dynamic = 'force-dynamic'

export default function Page() {
  return <StaffSettings />
}
