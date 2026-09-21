import { ClipboardList } from 'lucide-react'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import { productsSectionsContent } from '@/data/products'

export const metadata: Metadata = { title: 'Purchase orders' }

export default function Page() {
  return <SectionEmpty {...productsSectionsContent.purchaseOrders} icon={ClipboardList} />
}
