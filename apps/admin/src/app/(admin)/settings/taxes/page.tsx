import type { Metadata } from 'next'
import TaxesSettings from '@/components/settings/taxes/taxes-settings'

export const metadata: Metadata = { title: 'Taxes & GST' }

export default function Page() {
  return <TaxesSettings />
}
