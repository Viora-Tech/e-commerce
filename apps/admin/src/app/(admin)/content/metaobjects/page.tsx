import { Braces } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import { contentContent } from '@/data/content'

export const metadata: Metadata = { title: 'Metaobjects' }

export default function Page() {
  return <SectionEmpty {...contentContent.metaobjects} icon={Braces} />
}
