import type { Metadata } from 'next'
import { GeneralSettings } from '@/components/settings/general-settings'

export const metadata: Metadata = { title: 'General' }

export default function Page() {
  return <GeneralSettings />
}
