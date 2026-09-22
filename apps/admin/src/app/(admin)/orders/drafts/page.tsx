import { FileEdit } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import { ordersSectionsContent } from '@/data/orders'

export const metadata: Metadata = { title: 'Draft orders' }

export default function Page() {
  return <SectionEmpty {...ordersSectionsContent.drafts} icon={FileEdit} />
}
