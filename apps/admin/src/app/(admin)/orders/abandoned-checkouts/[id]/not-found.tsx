import { ShoppingCart } from '@commerce/ui/icons'
import SectionEmpty from '@/components/layout/section-empty'
import { abandonedDetailContent } from '@/data/abandoned-detail'

export default function NotFound() {
  return <SectionEmpty {...abandonedDetailContent.notFound} icon={ShoppingCart} />
}
