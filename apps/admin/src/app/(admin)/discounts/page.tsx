import { BadgePercent } from 'lucide-react'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import { discountsContent } from '@/data/discounts'

export const metadata: Metadata = { title: 'Discounts' }

export default function Page() {
  return <SectionEmpty {...discountsContent.index} icon={BadgePercent} />
}
