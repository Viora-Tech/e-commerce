import { Filter } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import { customersContent } from '@/data/customers'

export const metadata: Metadata = { title: 'Segments' }

export default function Page() {
  return <SectionEmpty {...customersContent.segments} icon={Filter} />
}
