import { Package } from 'lucide-react'

type ProductThumbProps = { url: string | null; title: string }

/** 5:2171: 46px thumbnail with a 12px radius. */
export default function HomeProductThumb({ url, title }: ProductThumbProps) {
  return url ? (
    // biome-ignore lint/performance/noImgElement: merchant media URLs, no optimisation pipeline yet.
    <img
      src={url}
      alt=""
      className="size-[2.875rem] shrink-0 rounded-xl bg-background object-cover"
    />
  ) : (
    <span className="flex size-[2.875rem] shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground">
      <Package className="size-5" aria-hidden="true" />
      <span className="sr-only">{title}</span>
    </span>
  )
}
