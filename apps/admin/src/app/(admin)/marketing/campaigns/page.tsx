import { Send } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import { marketingContent } from '@/data/marketing'

export const metadata: Metadata = { title: 'Campaigns' }

export default function Page() {
  return <SectionEmpty {...marketingContent.campaigns} icon={Send} />
}
