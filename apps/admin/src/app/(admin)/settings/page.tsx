import type { Metadata } from 'next'
import SettingsHome from '@/components/settings/settings-home'

export const metadata: Metadata = { title: 'Settings' }

/** The settings home: setup checklist and every settings page. */
export default function Page() {
  return <SettingsHome />
}
