import { formatPaise } from '@commerce/blocks'
import { checkoutContent as content } from '@/data/checkout'

type SummaryLineProps = {
  title: string
  variant: string | null
  quantity: number
  linePaise: number
  imageUrl: string | null
  preorder?: boolean
}

/** First letter of the product, drawn when a line has no image. */
const initial = (title: string): string => title.trim().charAt(0).toUpperCase() || '·'

/** One item in the order summary: thumbnail with its quantity, title, variant, price. */
export default function SummaryLine({
  title,
  variant,
  quantity,
  linePaise,
  imageUrl,
  preorder = false,
}: SummaryLineProps) {
  return (
    <li className="flex items-center gap-4">
      <div className="relative size-14 shrink-0">
        <div className="absolute inset-0 overflow-hidden rounded-ck border border-ck-summary-line bg-ck-bg">
          {imageUrl ? (
            // biome-ignore lint/performance/noImgElement: cart thumbnails come pre-sized from the media pipeline.
            <img src={imageUrl} alt="" loading="lazy" className="size-full! object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-full items-center justify-center text-[1.125rem] font-semibold text-ck-muted"
            >
              {initial(title)}
            </span>
          )}
        </div>
        {quantity > 1 ? (
          <span className="absolute -top-2 -right-2 flex min-w-5 items-center justify-center rounded-full bg-ck-summary-ink px-1.5 text-[0.6875rem] leading-5 font-semibold text-ck-summary tabular-nums">
            {quantity}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="line-clamp-2 text-[0.9375rem] leading-snug font-medium">{title}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-[0.8125rem] text-ck-summary-muted">
          {variant ? <span>{variant}</span> : null}
          <span className="sr-only">{content.quantity(quantity)}</span>
          {preorder ? (
            <span className="rounded-full border border-ck-summary-line px-2 text-[0.6875rem] leading-[1.125rem] font-medium tracking-wide uppercase">
              {content.preorder}
            </span>
          ) : null}
        </p>
      </div>
      <p className="shrink-0 text-[0.9375rem] font-medium tabular-nums">{formatPaise(linePaise)}</p>
    </li>
  )
}
