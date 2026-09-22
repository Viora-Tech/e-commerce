import { UserRound } from '@commerce/ui/icons'
import SectionEmpty from '@/components/layout/section-empty'
import { customersContent } from '@/data/customers'

export default function NotFound() {
  return <SectionEmpty {...customersContent.detail} icon={UserRound} />
}
