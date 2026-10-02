import type { Metadata } from 'next'
import AppearanceSettings from '@/components/settings/appearance-settings'

export const metadata: Metadata = { title: 'Appearance' }

export default function Page() {
  return <AppearanceSettings />
}
