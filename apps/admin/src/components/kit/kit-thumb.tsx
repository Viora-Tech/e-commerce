import { ImageIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import FallbackImage from '@/components/layout/fallback-image'
import ProductThumb from '@/components/products/product-thumb'

type KitThumbProps = { src: string | null; alt: string; size?: 'table' | 'list' | 'category' }

/*
 * Thumbnails from the sheet: table rows use the one table thumb (Figma "Table / Cell · Thumb"),
 * list 14:874 (56, radius 12), category 14:918 (46, radius 4, hairline border). A missing or
 * broken picture shows the image icon instead of a white box.
 */
const THUMB = {
  list: 'size-14 rounded-xl',
  category: 'size-[2.875rem] rounded-sm border border-border',
} as const

export default function KitThumb({ src, alt, size = 'table' }: KitThumbProps) {
  // Early returns
  if (size === 'table') return <ProductThumb url={src} alt={alt} />

  // Render logic
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden bg-card text-muted-foreground',
        THUMB[size],
      )}
    >
      <FallbackImage
        src={src}
        alt={alt}
        className="size-full bg-media object-contain p-1"
        fallback={<ImageIcon className="size-4" aria-hidden />}
      />
    </span>
  )
}
