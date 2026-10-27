import type { CheckoutLook } from '@commerce/core'
import { checkoutBrandingVars } from '@commerce/core/checkout-settings'
import type { CSSProperties, ReactNode } from 'react'
import CheckoutBrand from '@/components/checkout/checkout-brand'

type CheckoutShellProps = {
  look: CheckoutLook
  backHref: string
  backLabel: string
  /** The left column (order summary). Without it the page is one calm centred column. */
  summary?: ReactNode
  children: ReactNode
}

/**
 * The locked checkout's frame, the same on the form, payment and thank-you pages. Two
 * columns from 64rem: the order summary on the merchant's summary colour (or image) on
 * the left, sticky; the white working column on the right. On a phone the brand sits on
 * top, then the summary (collapsed by the page), then the form. Its look is only the
 * merchant's checkout branding, set here as --ck-* properties: no theme reaches it.
 */
export default function CheckoutShell({
  look,
  backHref,
  backLabel,
  summary,
  children,
}: CheckoutShellProps) {
  // Render logic
  const vars = checkoutBrandingVars(look.branding) as CSSProperties
  const image = look.branding.summary.kind === 'image' && look.branding.summary.image !== null
  const brand = (
    <CheckoutBrand
      storeName={look.storeName}
      logoUrl={look.logoUrl}
      href={backHref}
      label={backLabel}
    />
  )

  return (
    <div
      className="ck min-h-dvh bg-ck-bg font-ck text-[0.9375rem] leading-normal text-ck-ink antialiased [font-feature-settings:'cv11','ss01'] [text-rendering:optimizeLegibility]"
      style={vars}
    >
      {summary ? (
        <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <aside className="relative isolate bg-ck-summary bg-[image:var(--ck-summary-image)] bg-cover bg-center text-ck-summary-ink">
            {image ? (
              <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ck-summary-wash" />
            ) : null}
            <div className="flex w-full flex-col gap-6 px-5 pt-5 pb-0 sm:px-8 lg:sticky lg:top-0 lg:ml-auto! lg:max-h-dvh lg:max-w-[33rem] lg:gap-10 lg:overflow-y-auto lg:px-14 lg:pt-14 lg:pb-14 xl:pr-20">
              {brand}
              {summary}
            </div>
          </aside>
          <section className="min-w-0 bg-ck-bg lg:[box-shadow:-1px_0_0_var(--ck-line),-24px_0_48px_-32px_rgb(0_0_0/0.12)]">
            <div className="w-full px-5 pt-6 pb-10 sm:px-8 lg:max-w-[35rem] lg:px-14 lg:pt-14 lg:pb-20 xl:pl-20">
              {children}
            </div>
          </section>
        </div>
      ) : (
        <div className="mx-auto! flex min-h-dvh w-full max-w-[30rem] flex-col gap-10 px-5 py-8 sm:py-14">
          <div className="text-ck-ink [--ck-summary-ink:var(--ck-ink)]">{brand}</div>
          {children}
        </div>
      )}
    </div>
  )
}
