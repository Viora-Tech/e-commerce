import type { CheckoutLook } from '@commerce/core'
import { checkoutBrandingVars } from '@commerce/core/checkout-settings'
import type { PolicyLink } from '@commerce/core/policies'
import type { CSSProperties, ReactNode } from 'react'
import CheckoutBrand from '@/components/checkout/checkout-brand'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import CheckoutMoney from '@/components/checkout/checkout-money'
import { checkoutContent as content } from '@/data/checkout'
import { CK_CARD } from '@/lib/checkout-classes'

type CheckoutPageShellProps = {
  look: CheckoutLook
  /** Where the store's name leads: the cart while checking out, the shop after it. */
  backHref: string
  backLabel: string
  /** The order summary: a card on the right from `lg`, a fold-out card at the top on a phone. */
  summary: ReactNode
  /** Under the summary on a computer only, inside its card: the Pay button and its fine print. */
  summaryEnd?: ReactNode
  /** Published policies, linked under the cards. */
  policies?: PolicyLink[]
  /** Fixed to the bottom of a phone screen (the Pay bar); gone from `lg`, where `summaryEnd` has it. */
  bottomBar?: ReactNode
  /** Replaces the bag (back to the cart) on the right of the header, e.g. "Continue shopping" after the order. */
  headerEnd?: ReactNode
  children: ReactNode
}

/** The help link and the bag: one outlined shape at one height, so they read as a pair. */
const HEADER_ACTION =
  'inline-flex h-10 items-center rounded-full border border-ck-line outline-none transition-colors duration-150 hover:border-ck-muted/50 hover:bg-ck-soft focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] motion-reduce:transition-none'

/**
 * The checkout's frame (design: checkout-design Main/Mobile). A quiet white header with the
 * store's name (or logo) and a bag back to the cart, over the #FAFAFA canvas; the cards on
 * the left and the order summary card on the right, sticky, from `lg`; on a phone the summary
 * folds into a card at the top and the cards follow. The store's policies sit under the
 * cards. Its look is only the merchant's checkout branding, set here as --ck-* properties: no
 * theme reaches it. Light or dark follows the store's mode (or the shopper's system setting
 * when the store leaves it to them), see the `.ck` block in globals.css.
 */
export default function CheckoutPageShell({
  look,
  backHref,
  backLabel,
  summary,
  summaryEnd = null,
  policies = [],
  bottomBar = null,
  headerEnd = null,
  children,
}: CheckoutPageShellProps) {
  // Render logic
  const vars = checkoutBrandingVars(look.branding) as CSSProperties
  const image = look.branding.summary.kind === 'image' && look.branding.summary.image !== null
  const digits = look.contactPhone?.replace(/\D/g, '') ?? ''
  const help =
    digits.length >= 10 ? `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}` : null

  return (
    <CheckoutMoney>
      <div
        className="ck flex min-h-dvh flex-col bg-ck-canvas font-ck text-[0.9375rem] leading-normal text-ck-ink antialiased [font-feature-settings:'cv11','ss01'] [text-rendering:optimizeLegibility]"
        style={vars}
      >
        <header className="border-b border-ck-line bg-ck-bg">
          <div className="mx-auto! flex w-full max-w-[70rem] items-center justify-between gap-4 px-4 py-3.5 sm:px-6 [--ck-summary-ink:var(--ck-ink)]">
            <CheckoutBrand
              storeName={look.storeName}
              logoUrl={look.logoUrl}
              logoDarkUrl={look.logoDarkUrl}
              href={backHref}
              label={backLabel}
            />
            <div className="flex shrink-0 items-center gap-2">
              {help ? (
                <a
                  href={help}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={content.help.aria}
                  className={`${HEADER_ACTION} gap-2 px-3.5 text-[0.8125rem] font-medium text-ck-ink! no-underline`}
                >
                  <CheckoutIcon name="whatsapp" className="size-4 text-ck-success" />
                  <span className="sm:hidden">{content.help.short}</span>
                  <span className="hidden sm:inline">{content.help.label}</span>
                </a>
              ) : null}
              {/* As Shopify's checkout: a bag back to the cart, not a "Secure" badge. */}
              {headerEnd ?? (
                <a
                  href={backHref}
                  aria-label={backLabel}
                  title={backLabel}
                  className={`${HEADER_ACTION} w-10 justify-center text-ck-ink!`}
                >
                  <CheckoutIcon name="bag" className="size-[1.125rem]" />
                </a>
              )}
            </div>
          </div>
        </header>
        <div
          className={`mx-auto! grid w-full max-w-[70rem] flex-1 content-start gap-3 px-3 pt-3 sm:px-6 sm:pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-6 lg:pt-8 lg:pb-16 ${bottomBar ? 'pb-40' : 'pb-8'}`}
        >
          <aside className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:self-start">
            <div
              className={`${CK_CARD} relative isolate bg-ck-summary! bg-[image:var(--ck-summary-image)] bg-cover bg-center text-ck-summary-ink lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden lg:rounded-[calc(var(--ck-radius)*1.6)] lg:p-5`}
            >
              {image ? (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded-[inherit] bg-ck-summary-wash"
                />
              ) : null}
              {summary}
              {summaryEnd ? (
                <div className="hidden flex-col gap-2.5 pt-5 lg:flex">{summaryEnd}</div>
              ) : null}
            </div>
          </aside>
          <div className="flex min-w-0 flex-col gap-3 sm:gap-4 lg:col-start-1 lg:row-start-1">
            {children}
            <nav
              aria-label={content.policiesLabel}
              className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-3 text-[0.75rem] text-ck-muted"
            >
              {policies.map((p) => (
                <a
                  key={p.type}
                  href={p.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ck-muted! no-underline outline-none transition-colors duration-150 hover:text-ck-ink! focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] motion-reduce:transition-none"
                >
                  {p.title}
                </a>
              ))}
              <span>&copy; {look.storeName}</span>
            </nav>
          </div>
        </div>
        {bottomBar ? (
          <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-1.5 border-t border-ck-line bg-ck-bg px-4 pt-3 pb-[max(1.125rem,env(safe-area-inset-bottom))] [box-shadow:0_-8px_24px_rgb(0_0_0/0.06)] lg:hidden">
            {bottomBar}
          </div>
        ) : null}
      </div>
    </CheckoutMoney>
  )
}
