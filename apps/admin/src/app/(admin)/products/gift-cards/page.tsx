import { Gift } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import { productsSectionsContent } from '@/data/products'

export const metadata: Metadata = { title: 'Gift cards' }

export default function Page() {
  return <SectionEmpty {...productsSectionsContent.giftCards} icon={Gift} />
}
