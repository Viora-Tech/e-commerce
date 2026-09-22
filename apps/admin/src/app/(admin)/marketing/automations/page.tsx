import { Workflow } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import { marketingContent } from '@/data/marketing'

export const metadata: Metadata = { title: 'Automations' }

export default function Page() {
  return <SectionEmpty {...marketingContent.automations} icon={Workflow} />
}
