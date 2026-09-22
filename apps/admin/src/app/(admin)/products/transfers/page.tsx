import { ArrowLeftRight } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import { productsSectionsContent } from '@/data/products'

export const metadata: Metadata = { title: 'Transfers' }

export default function Page() {
  return <SectionEmpty {...productsSectionsContent.transfers} icon={ArrowLeftRight} />
}
