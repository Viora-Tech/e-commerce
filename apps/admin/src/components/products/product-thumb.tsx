import { ImageIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'

type ProductThumbProps = { url: string | null; alt?: string; className?: string }

/* 32px tile on a hairline, 6px radius, the picture inset to 28px. */
export default function ProductThumb({ url, alt = '', className }: ProductThumbProps) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border text-muted-foreground',
        url ? 'bg-media' : 'bg-card',
        className,
      )}
    >
      {url ? (
        // biome-ignore lint/performance/noImgElement: remote catalogue images, no optimisation pipeline yet.
        <img src={url} alt={alt} className="size-7 object-contain" />
      ) : (
        <ImageIcon className="size-4" aria-hidden />
      )}
    </span>
  )
}
