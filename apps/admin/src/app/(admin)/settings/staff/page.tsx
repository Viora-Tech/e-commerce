import type { Metadata } from 'next'
import StaffSettings from '@/components/staff/staff-settings'

export const metadata: Metadata = { title: 'Staff' }

export default function Page() {
  return <StaffSettings />
}
