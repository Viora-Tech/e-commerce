import { FolderOpen } from 'lucide-react'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import { contentContent } from '@/data/content'

export const metadata: Metadata = { title: 'Content' }

export default function Page() {
  return <SectionEmpty {...contentContent.index} icon={FolderOpen} />
}
