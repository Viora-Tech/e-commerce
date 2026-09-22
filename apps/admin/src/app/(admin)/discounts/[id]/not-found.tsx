import { BadgePercent } from '@commerce/ui/icons'
import SectionEmpty from '@/components/layout/section-empty'
import { discountsContent } from '@/data/discounts'

export default function NotFound() {
  return <SectionEmpty {...discountsContent.detail} icon={BadgePercent} />
}
