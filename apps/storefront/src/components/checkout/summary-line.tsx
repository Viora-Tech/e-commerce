import { formatPaise } from '@commerce/blocks'
import { checkoutContent as content } from '@/data/checkout'

type SummaryLineProps = {
  title: string
  variant: string | null
  quantity: number
  linePaise: number
  imageUrl: string | null
  preorder?: boolean
  /** The pre-order note (#936), under the title; null for none. */
  preorderNote?: string | null | undefined
  /** How prices read: the checkout passes the market's (`useFormatPaise`); rupees by default. */
  format?: ((paise: number) => string) | undefined
  /** The line's price, formatted (a market catalog's fixed price × quantity); wins over `format`. */
  price?: string | undefined
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
  preorderNote = null,
  format = formatPaise,
  price,
}: SummaryLineProps) {
  return (
    <li className="flex flex-wrap items-center gap-3 lg:gap-3.5">
      <div className="relative size-13 shrink-0 lg:size-16">
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
        <span
          aria-hidden="true"
          className="absolute -top-[0.4375rem] -right-[0.4375rem] flex h-5 min-w-5 items-center justify-center rounded-[0.375rem] bg-ck-summary-ink px-1 text-[0.6875rem] font-semibold text-ck-summary tabular-nums"
        >
          {quantity}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="line-clamp-2 text-[0.8125rem] leading-snug font-semibold lg:text-[0.875rem]">
          {title}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-[0.8125rem] text-ck-summary-muted">
          {variant ? <span>{variant}</span> : null}
          <span className="sr-only">{content.quantity(quantity)}</span>
          {preorder ? (
            <span className="rounded-full border border-ck-summary-line px-2 text-[0.75rem] leading-[1.25rem] font-medium">
              {content.preorder}
            </span>
          ) : null}
        </p>
      </div>
      <p className="shrink-0 text-[0.8125rem] font-semibold tabular-nums lg:text-[0.875rem]">
        {price ?? format(linePaise)}
      </p>
      {preorderNote ? (
        <p className="basis-full text-[0.75rem] leading-snug whitespace-pre-line text-ck-summary-muted">
          {preorderNote}
        </p>
      ) : null}
    </li>
  )
}
