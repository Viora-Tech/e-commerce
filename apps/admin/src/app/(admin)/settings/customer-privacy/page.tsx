import type { Metadata } from 'next'
import CustomerPrivacySettings from '@/components/settings/customer-privacy-settings'

export const metadata: Metadata = { title: 'Customer privacy' }

export default function Page() {
  return <CustomerPrivacySettings />
}
