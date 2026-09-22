import { Megaphone } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import { marketingContent } from '@/data/marketing'

export const metadata: Metadata = { title: 'Marketing' }

export default function Page() {
  return <SectionEmpty {...marketingContent.index} icon={Megaphone} />
}
