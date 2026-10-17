import KoomerceMark from '@commerce/ui/brand'
import Link from 'next/link'
import { siteContent } from '@/data/site'

export default function BrandMark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <KoomerceMark className="h-6 w-auto text-foreground" />
      <span className="text-base font-bold text-foreground">{siteContent.brand}</span>
    </Link>
  )
}
