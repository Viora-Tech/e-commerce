import type { Metadata } from 'next'
import CostsSettings from '@/components/settings/costs/costs-settings'

export const metadata: Metadata = { title: 'Costs for profit' }

export default function Page() {
  return <CostsSettings />
}
