import { checkoutContent as content } from '@/data/checkout'

type CheckoutBrandProps = {
  storeName: string
  logoUrl: string | null
  /** Where it leads: the cart while checking out, the shop after it. */
  href: string
  /** Read out with the link: "Back to cart", "Continue shopping". */
  label: string
}

/** The store's logo (or its name in heavy type, as the design) at the top left of the checkout. */
export default function CheckoutBrand({ storeName, logoUrl, href, label }: CheckoutBrandProps) {
  return (
    <a
      href={href}
      title={label}
      className="flex min-h-9 min-w-0 items-center rounded-sm text-ck-ink! no-underline outline-none focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)]"
    >
      {logoUrl ? (
        // biome-ignore lint/performance/noImgElement: a merchant logo of unknown size from the media library; nothing to optimise.
        <img
          src={logoUrl}
          alt={storeName}
          className="h-7! w-auto! max-w-[10rem] object-contain object-left"
        />
      ) : (
        <span className="truncate text-[1rem] font-extrabold tracking-[0.02em] sm:text-[1.125rem]">
          {storeName || content.title}
        </span>
      )}
      <span className="sr-only">, {label}</span>
    </a>
  )
}
