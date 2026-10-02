import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent as content } from '@/data/checkout'

type CheckoutBrandProps = {
  storeName: string
  logoUrl: string | null
  /** Where the arrow goes: the cart while checking out, the shop after it. */
  backHref: string
  backLabel: string
}

/** The store's logo (or name) with a quiet way back, at the top of the checkout. */
export default function CheckoutBrand({
  storeName,
  logoUrl,
  backHref,
  backLabel,
}: CheckoutBrandProps) {
  return (
    <div className="flex min-h-10 items-center gap-3">
      <a
        href={backHref}
        aria-label={backLabel}
        title={backLabel}
        className="-ml-2! inline-flex size-9 shrink-0 items-center justify-center rounded-full text-ck-summary-ink! no-underline opacity-70 outline-none transition-[opacity,background-color] duration-150 hover:bg-ck-summary-line hover:opacity-100 focus-visible:opacity-100 focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] motion-reduce:transition-none"
      >
        <CheckoutIcon name="back" className="size-[1.125rem]" />
      </a>
      <a
        href="/"
        className="flex min-w-0 items-center text-ck-summary-ink! no-underline outline-none focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)]"
      >
        {logoUrl ? (
          // biome-ignore lint/performance/noImgElement: a merchant logo of unknown size from the media library; nothing to optimise.
          <img
            src={logoUrl}
            alt={storeName}
            className="h-7! w-auto! max-w-[10rem] object-contain object-left"
          />
        ) : (
          <span className="truncate text-[1.0625rem] font-semibold tracking-[-0.01em]">
            {storeName || content.title}
          </span>
        )}
      </a>
    </div>
  )
}
