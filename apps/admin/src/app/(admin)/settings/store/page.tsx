import type { Metadata } from 'next'
import GeneralSettings from '@/components/settings/general-settings'

export const metadata: Metadata = { title: 'Store details' }

export default function Page() {
  return <GeneralSettings />
}
