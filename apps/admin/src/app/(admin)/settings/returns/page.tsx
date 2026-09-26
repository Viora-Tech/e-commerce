import type { Metadata } from 'next'
import ReturnsSettings from '@/components/settings/returns-settings'

export const metadata: Metadata = { title: 'Returns' }

export default function Page() {
  return <ReturnsSettings />
}
