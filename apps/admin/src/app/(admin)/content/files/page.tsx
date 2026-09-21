import { Images } from 'lucide-react'
import type { Metadata } from 'next'
import { SectionEmpty } from '@/components/layout/section-empty'
import { contentContent } from '@/data/content'

export const metadata: Metadata = { title: 'Files' }

export default function Page() {
  return <SectionEmpty {...contentContent.files} icon={Images} />
}
