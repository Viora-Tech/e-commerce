import type { Metadata } from 'next'
import CustomerAccountsSettings from '@/components/settings/customer-accounts-settings'

export const metadata: Metadata = { title: 'Customer accounts' }

export default function Page() {
  return <CustomerAccountsSettings />
}
