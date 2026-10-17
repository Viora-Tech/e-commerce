import type { Metadata } from 'next'
import InstalledApps from '@/components/apps/installed/installed-apps'

export const metadata: Metadata = { title: 'Installed apps' }

export default function Page() {
  return <InstalledApps />
}
