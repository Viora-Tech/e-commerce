import type { CheckoutLook } from '@commerce/core'
import { checkoutBrandingVars } from '@commerce/core/checkout-settings'
import type { PolicyLink } from '@commerce/core/policies'
import type { CSSProperties, ReactNode } from 'react'
import CheckoutBrand from '@/components/checkout/checkout-brand'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import CheckoutMoney from '@/components/checkout/checkout-money'
import SummaryGlass from '@/components/checkout/summary-glass'
import { checkoutContent as content } from '@/data/checkout'
import { CK_CARD } from '@/lib/checkout-classes'
import { whatsAppHelp } from '@/lib/thank-you'

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
  /** Under the summary card on a computer: the trust lines. */
  summaryAfter?: ReactNode
  /** Fixed to the bottom of a phone screen (the Pay bar); gone from `lg`, where `summaryEnd` has it. */
  bottomBar?: ReactNode
  /** "Back to cart · 3 items" on a computer; the phone shows the short form. */
  cartLabel?: string | undefined
  cartShort?: string | undefined
  /** Replaces the cart link on the right of the header, e.g. "Continue shopping" after the order. */
  headerEnd?: ReactNode
  children: ReactNode
}

/** The header's two links: quiet text at one height, each still a comfortable tap. */
const HEADER_ACTION =
  'inline-flex min-h-11 items-center gap-1.5 rounded-ck text-[0.8125rem] font-medium text-ck-muted! no-underline outline-none transition-colors duration-150 hover:text-ck-ink! focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] motion-reduce:transition-none'

/**
 * The checkout's frame (Figma: Checkout · Polish). A quiet header with the store's logo, help
 * and the way back to the cart, over the canvas; the cards on
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
  summaryAfter = null,
  policies = [],
  bottomBar = null,
  cartLabel,
  cartShort,
  headerEnd = null,
  children,
}: CheckoutPageShellProps) {
  // Render logic
  const vars = checkoutBrandingVars(look.branding) as CSSProperties
  const image = look.branding.summary.kind === 'image' && look.branding.summary.image !== null
  const help = whatsAppHelp(look.contactPhone)

  return (
    <CheckoutMoney>
      <div
        className="ck flex min-h-dvh flex-col bg-ck-canvas font-ck text-[0.9375rem] leading-normal text-ck-ink antialiased"
        style={vars}
      >
        <header className="border-b border-ck-line bg-ck-canvas">
          <div className="mx-auto! flex min-h-14 w-full max-w-[70rem] items-center justify-between gap-4 px-4 sm:px-6 lg:h-18 xl:px-0 [--ck-summary-ink:var(--ck-ink)]">
            <CheckoutBrand
              storeName={look.storeName}
              logoUrl={look.logoUrl}
              logoDarkUrl={look.logoDarkUrl}
              href={backHref}
              label={backLabel}
            />
            <div className="flex shrink-0 items-center gap-4 sm:gap-5">
              {help ? (
                <a
                  href={help}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={content.help.aria}
                  className={HEADER_ACTION}
                >
                  <CheckoutIcon name="whatsapp" className="size-4 text-ck-success" />
                  <span className="sm:hidden">{content.help.short}</span>
                  <span className="hidden sm:inline">{content.help.label}</span>
                </a>
              ) : null}
              {headerEnd ?? (
                <a
                  href={backHref}
                  aria-label={backLabel}
                  title={backLabel}
                  className={HEADER_ACTION}
                >
                  <CheckoutIcon name="bag" className="size-4" />
                  {cartShort ? <span className="sm:hidden">{cartShort}</span> : null}
                  {cartLabel ? <span className="hidden sm:inline">{cartLabel}</span> : null}
                </a>
              )}
            </div>
          </div>
        </header>
        <div
          className={`mx-auto! grid w-full max-w-[70rem] flex-1 content-start gap-3 px-3 pt-3 sm:px-6 sm:pt-6 lg:grid-cols-[minmax(0,41.25rem)_24.75rem] xl:px-0 pb-8 lg:gap-12 lg:pt-10 lg:pb-14`}
        >
          <aside className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:self-start">
            <div
              className={`${CK_CARD} relative isolate overflow-hidden bg-ck-summary! bg-[image:var(--ck-summary-image)] bg-cover bg-center text-ck-summary-ink [box-shadow:var(--ck-card-shadow)]! lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden lg:rounded-[calc(var(--ck-radius)*1.6)] lg:p-5`}
            >
              {image ? (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded-[inherit] bg-ck-summary-wash"
                />
              ) : (
                <SummaryGlass />
              )}
              {summary}
              {summaryEnd ? (
                <div className="hidden flex-col gap-4 pt-4 lg:flex">{summaryEnd}</div>
              ) : null}
            </div>
            {summaryAfter ? <div className="hidden pt-4 lg:block">{summaryAfter}</div> : null}
          </aside>
          <div className="flex min-w-0 flex-col gap-3 sm:gap-4 lg:col-start-1 lg:row-start-1">
            {children}
          </div>
        </div>
        <nav
          aria-label={content.policiesLabel}
          className={`mx-auto! flex w-full max-w-[70rem] flex-wrap gap-x-5 gap-y-2 px-4 py-5 text-[0.75rem] text-ck-faint sm:px-6 xl:px-0 ${bottomBar ? 'pb-40 lg:pb-5' : 'pb-5'}`}
        >
          {policies.map((p) => (
            <a
              key={p.type}
              href={p.href}
              target="_blank"
              rel="noreferrer"
              className="text-ck-faint! no-underline outline-none transition-colors duration-150 hover:text-ck-ink! focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] motion-reduce:transition-none"
            >
              {p.title}
            </a>
          ))}
          <span>&copy; {look.storeName}</span>
        </nav>
        {bottomBar ? (
          <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-1.5 border-t border-ck-line bg-ck-bg px-4 pt-3 pb-[max(1.125rem,env(safe-area-inset-bottom))] [box-shadow:0_-8px_24px_rgb(0_0_0/0.06)] lg:hidden">
            {bottomBar}
          </div>
        ) : null}
      </div>
    </CheckoutMoney>
  )
}
