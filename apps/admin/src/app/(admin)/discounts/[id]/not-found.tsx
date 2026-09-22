import { BadgePercent } from 'lucide-react'
import SectionEmpty from '@/components/layout/section-empty'
import { discountsContent } from '@/data/discounts'

export default function NotFound() {
  return <SectionEmpty {...discountsContent.detail} icon={BadgePercent} />
}
