import { Newspaper } from 'lucide-react'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import { onlineStoreContent } from '@/data/online-store'

export const metadata: Metadata = { title: 'Blog posts' }

export default function Page() {
  return <SectionEmpty {...onlineStoreContent.blog} icon={Newspaper} />
}
