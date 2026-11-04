import { checkoutContent as content } from '@/data/checkout'

type CheckoutBrandProps = {
  storeName: string
  logoUrl: string | null
  /** Shown instead of `logoUrl` on a dark checkout. */
  logoDarkUrl?: string | null | undefined
  /** Where it leads: the cart while checking out, the shop after it. */
  href: string
  /** Read out with the link: "Back to cart", "Continue shopping". */
  label: string
}

/** The store's logo (or its name in heavy type, as the design) at the top left of the checkout. */
export default function CheckoutBrand({
  storeName,
  logoUrl,
  logoDarkUrl,
  href,
  label,
}: CheckoutBrandProps) {
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
          className={`h-8! w-auto! max-w-[11rem] object-contain object-left sm:h-9! sm:max-w-[12rem]${logoDarkUrl ? ' ck-logo-light' : ''}`}
        />
      ) : null}
      {logoUrl && logoDarkUrl ? (
        // biome-ignore lint/performance/noImgElement: a merchant logo of unknown size from the media library; nothing to optimise.
        <img
          src={logoDarkUrl}
          alt={storeName}
          className="ck-logo-dark h-8! w-auto! max-w-[11rem] object-contain object-left sm:h-9! sm:max-w-[12rem]"
        />
      ) : null}
      {logoUrl ? null : (
        <span className="truncate text-[1.125rem] font-semibold tracking-[-0.02em] sm:text-[1.25rem]">
          {storeName || content.title}
        </span>
      )}
      <span className="sr-only">, {label}</span>
    </a>
  )
}
