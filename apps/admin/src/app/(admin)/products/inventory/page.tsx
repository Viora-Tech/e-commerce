import { Boxes } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import { productsSectionsContent } from '@/data/products'

export const metadata: Metadata = { title: 'Inventory' }

export default function Page() {
  return <SectionEmpty {...productsSectionsContent.inventory} icon={Boxes} />
}
