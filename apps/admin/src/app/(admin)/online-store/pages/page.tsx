import type { Metadata } from 'next'
import PagesList from '@/components/online-store/pages-list'

export const metadata: Metadata = { title: 'Pages' }

export default function Page() {
  return <PagesList />
}
