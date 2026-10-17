import Link from 'next/link'
import { siteContent } from '@/data/site'

export default function BrandMark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="grid size-8 place-items-center rounded-lg bg-foreground text-base font-bold text-background">
        {siteContent.mark}
      </span>
      <span className="text-base font-bold text-foreground">{siteContent.brand}</span>
    </Link>
  )
}
