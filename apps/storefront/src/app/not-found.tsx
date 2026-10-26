import { connection } from 'next/server'
import type { CSSProperties } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { bareNotFoundContent as copy } from '@/data/errors'
import { CK_BUTTON_PRIMARY, CK_HEADING } from '@/lib/checkout-classes'
import { CK_FALLBACK_VARS, ERROR_ENTER } from '@/lib/error-page'

/**
 * The bare 404 for paths outside any store segment (`/api/…` that matches no route, say), in
 * the checkout's neutral palette (light or dark with the shopper's setting); no store is known
 * here. Rendered per request, never prerendered: the proxy sends a nonce script CSP with every
 * answer, and a static page's scripts carry no nonce, so the browser would refuse them.
 */
export default async function NotFound() {
  // Hooks
  await connection()

  // Render logic
  return (
    <html lang="en">
      <body>
        <div
          className="ck flex min-h-dvh items-center justify-center bg-ck-canvas px-5 py-12 font-ck text-ck-ink antialiased"
          style={CK_FALLBACK_VARS as CSSProperties}
        >
          <div
            className={`flex w-full max-w-[30rem] flex-col items-center gap-6 rounded-[calc(var(--ck-radius)*1.6)] bg-ck-bg px-6 py-10 text-center [box-shadow:var(--ck-card-shadow)] sm:px-10 sm:py-12 dark:[box-shadow:0_0_0_1px_var(--ck-line)] ${ERROR_ENTER}`}
          >
            <span
              aria-hidden="true"
              className="flex size-14 items-center justify-center rounded-full bg-ck-soft"
            >
              <CheckoutIcon name="bag" className="size-7" />
            </span>
            <div className="flex flex-col gap-3">
              <h1 className={`${CK_HEADING} text-[1.625rem]! sm:text-[1.875rem]!`}>{copy.title}</h1>
              <p className="text-[1rem] text-pretty text-ck-muted">{copy.body}</p>
            </div>
            <a href="/" className={`${CK_BUTTON_PRIMARY} h-12! no-underline sm:w-auto`}>
              {copy.home}
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
