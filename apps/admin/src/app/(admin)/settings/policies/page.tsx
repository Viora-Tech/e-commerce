import type { Metadata } from 'next'
import PoliciesSettings from '@/components/settings/policies-settings'

export const metadata: Metadata = { title: 'Policies' }

export default function Page() {
  return <PoliciesSettings />
}
