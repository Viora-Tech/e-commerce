import { cn } from '@commerce/ui/lib/utils'
import Image from 'next/image'

type KitThumbProps = { src: string | null; alt: string; size?: 'table' | 'list' | 'category' }

/*
 * Thumbnails from the sheet: table 14:1029 (40, radius 4, Neutral/200 border),
 * list 14:874 (56, radius 12), category 14:918 (46, radius 4, Neutral/200 border).
 */
const THUMB = {
  table: 'size-10 rounded-sm border border-secondary',
  list: 'size-14 rounded-xl',
  category: 'size-[2.875rem] rounded-sm border border-secondary',
} as const

const THUMB_PX = { table: 40, list: 56, category: 46 } as const

export default function KitThumb({ src, alt, size = 'table' }: KitThumbProps) {
  // Render logic
  return (
    <span
      className={cn('relative shrink-0 overflow-hidden', src ? 'bg-media' : 'bg-card', THUMB[size])}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={THUMB_PX[size]}
          height={THUMB_PX[size]}
          className="size-full object-contain p-1"
        />
      ) : null}
    </span>
  )
}
