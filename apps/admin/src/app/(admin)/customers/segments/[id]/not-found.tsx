import { Users } from '@commerce/ui/icons'
import SectionEmpty from '@/components/layout/section-empty'
import { segmentsContent } from '@/data/customers'

export default function NotFound() {
  return <SectionEmpty {...segmentsContent.notFound} icon={Users} />
}
