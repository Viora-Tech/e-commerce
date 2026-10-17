import type { CheckoutLook } from '@commerce/core'
import { checkoutBrandingVars } from '@commerce/core/checkout-settings'
import type { CSSProperties, ReactNode } from 'react'
import CheckoutBrand from '@/components/checkout/checkout-brand'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent as content } from '@/data/checkout'

type CheckoutStepsShellProps = {
  look: CheckoutLook
  backHref: string
  backLabel: string
  /** The order summary: a card on the right from `lg`, a fold-out bar under the header on a phone. */
  summary: ReactNode
  children: ReactNode
}

/**
 * The stepped checkout's frame (Figma Checkout). A quiet header (logo, "Need help? WhatsApp
 * us" when the store has a number, "Secure checkout"), then the steps on
 * the left and the order summary on the right, sticky, on every step. On a phone the summary
 * folds into a bar under the header and the step's button sticks to the bottom. Its look is
 * only the merchant's checkout branding, set here as --ck-* properties: no theme reaches it.
 * The summary card wears the branding's summary colour (or image under a wash of it).
 */
export default function CheckoutStepsShell({
  look,
  backHref,
  backLabel,
  summary,
  children,
}: CheckoutStepsShellProps) {
  // Render logic
  const vars = checkoutBrandingVars(look.branding) as CSSProperties
  const image = look.branding.summary.kind === 'image' && look.branding.summary.image !== null
  const digits = look.contactPhone?.replace(/\D/g, '') ?? ''
  const help =
    digits.length >= 10 ? `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}` : null

  return (
    <div
      className="ck min-h-dvh bg-ck-bg font-ck text-[0.9375rem] leading-normal text-ck-ink antialiased [font-feature-settings:'cv11','ss01'] [text-rendering:optimizeLegibility]"
      style={vars}
    >
      <header className="border-b border-ck-line">
        <div className="mx-auto! flex min-h-16 w-full max-w-[72rem] items-center justify-between gap-4 px-5 sm:px-8 [--ck-summary-ink:var(--ck-ink)]">
          <CheckoutBrand
            storeName={look.storeName}
            logoUrl={look.logoUrl}
            backHref={backHref}
            backLabel={backLabel}
          />
          <div className="flex shrink-0 items-center gap-5 text-[0.8125rem] font-medium text-ck-muted">
            {help ? (
              <a
                href={help}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-ck-ink"
              >
                <CheckoutIcon name="chat" className="size-3.5" />
                <span className="sm:hidden">{content.help.short}</span>
                <span className="hidden sm:inline">{content.help.label}</span>
              </a>
            ) : null}
            <p className="flex items-center gap-1.5">
              <CheckoutIcon name="lock" className="size-3.5" />
              <span className="sm:hidden">{content.secureShort}</span>
              <span className="hidden sm:inline">{content.secure}</span>
            </p>
          </div>
        </div>
      </header>
      <div className="mx-auto! grid w-full max-w-[72rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14 lg:px-8 lg:pt-10 lg:pb-20 xl:gap-20">
        <aside className="relative isolate bg-ck-summary bg-[image:var(--ck-summary-image)] bg-cover bg-center px-5 text-ck-summary-ink sm:px-8 lg:sticky lg:top-8 lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100dvh-4rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:rounded-[calc(var(--ck-radius)*2)] lg:border lg:border-ck-line lg:p-7 lg:[box-shadow:var(--ck-card-shadow)]">
          {image ? (
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ck-summary-wash" />
          ) : null}
          {summary}
          {look.branding.trustBadges ? (
            <div className="mt-6 hidden gap-2 border-t border-ck-line pt-5 text-[0.8125rem] lg:flex">
              <CheckoutIcon name="lock" className="mt-0.5 size-4 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <p className="font-medium">{content.assurance.title}</p>
                <p className="text-ck-muted">{content.assurance.body}</p>
              </div>
            </div>
          ) : null}
        </aside>
        <div className="min-w-0 px-5 pt-6 pb-10 sm:px-8 lg:col-start-1 lg:row-start-1 lg:px-0 lg:pt-0 lg:pb-0">
          {children}
        </div>
      </div>
    </div>
  )
}
