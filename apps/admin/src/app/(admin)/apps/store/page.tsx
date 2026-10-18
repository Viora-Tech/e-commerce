import type { Metadata } from 'next'
import AppsList from '@/components/apps/apps-list'

export const metadata: Metadata = { title: 'App Store' }

export default function Page() {
  return <AppsList />
}
