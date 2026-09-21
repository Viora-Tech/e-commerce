import type { Metadata } from 'next'
import { SettingsGrid } from '@/components/settings/settings-grid'

export const metadata: Metadata = { title: 'Settings' }

export default function Page() {
  return <SettingsGrid />
}
