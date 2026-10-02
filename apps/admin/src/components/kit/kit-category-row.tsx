import { ChevronRightIcon } from '@commerce/ui/icons'
import Link from 'next/link'
import KitThumb from './kit-thumb'

type KitCategoryRowProps = {
  href: string
  image: string | null
  label: string
  /** Optional count shown before the chevron. */
  count?: string
}

/** Sheet 14:917 category row: white, 1 Ambient lift, 6px inset, radius 6, 46px thumb, 18/400 label, 20px chevron. */
export default function KitCategoryRow({ href, image, label, count }: KitCategoryRowProps) {
  // Render logic
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-md bg-card p-1.5 shadow-lift motion-press hover:shadow-card-hover"
    >
      <KitThumb src={image} alt="" size="category" />
      <span className="min-w-0 flex-1 truncate text-kit-title font-normal text-foreground">
        {label}
      </span>
      {count ? (
        <span className="text-kit-body text-muted-foreground tabular-nums">{count}</span>
      ) : null}
      <ChevronRightIcon className="size-5 shrink-0 text-foreground" aria-hidden="true" />
    </Link>
  )
}
