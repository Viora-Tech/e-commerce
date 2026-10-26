'use client'

import { type CSSProperties, useEffect, useState, useTransition } from 'react'
import CheckoutBrand from '@/components/checkout/checkout-brand'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { errorPageContent as copy } from '@/data/errors'
import { CK_BUTTON_PRIMARY, CK_BUTTON_SECONDARY, CK_HEADING } from '@/lib/checkout-classes'
import { type ErrorHelp, errorHelpAction } from '@/lib/error-help-actions'
import { CK_FALLBACK_VARS, ERROR_ENTER, errorDigest } from '@/lib/error-page'

type ErrorScreenProps = {
  /**
   * `store`: a page failed inside the store's layout, so its header and footer are around it and
   * the card wears the theme. `checkout` and `global` (the whole store failed, no layout at all)
   * draw their own frame in the checkout's palette with the store's logo on top.
   */
  kind: 'store' | 'checkout' | 'global'
  error: unknown
  /** The boundary's `retry`: fetches and renders the segment again. */
  retry: () => void
}

/**
 * The storefront's error page: a calm card with what happened in one line, Try again (the
 * boundary's retry, which refetches the page rather than reloading the tab) and a way out (the
 * home page, or the cart on checkout routes), "Need help?" with the store's WhatsApp or email,
 * and the error reference for support. The store's name, logo, colours and contact come from
 * `errorHelpAction`; the page reads well without them.
 */
export default function ErrorScreen({ kind, error, retry }: ErrorScreenProps) {
  // Hooks
  const [help, setHelp] = useState<ErrorHelp | null>(null)
  const [retrying, startRetry] = useTransition()

  // A boundary-caught error is not uncaught, so GlitchTip's global handlers never see it:
  // report it here (the SDK loads only now, and does nothing when no DSN was configured).
  useEffect(() => {
    console.error(error)
    void import('@sentry/nextjs')
      .then((sentry) =>
        sentry.captureException(error, { mechanism: { type: `${kind}-boundary`, handled: true } }),
      )
      .catch(() => undefined)
  }, [error, kind])

  useEffect(() => {
    let alive = true
    errorHelpAction()
      .then((h) => {
        if (alive) setHelp(h)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  // Event handlers
  const handleRetry = () => startRetry(() => retry())

  // Render logic
  const text = copy[kind]
  const backHref = kind === 'checkout' ? '/cart' : '/'
  const digest = errorDigest(error)
  const contact = help?.whatsapp
    ? { href: help.whatsapp, label: copy.whatsapp, external: true }
    : help?.email
      ? { href: help.email, label: copy.email, external: false }
      : null
  const store = kind === 'store'
  const card = (
    <div
      className={`flex w-full flex-col items-center gap-6 text-center sm:gap-7 ${
        store
          ? 'max-w-[34rem]'
          : 'max-w-[30rem] rounded-[calc(var(--ck-radius)*1.6)] bg-ck-bg px-6 py-10 [box-shadow:var(--ck-card-shadow)] sm:px-10 sm:py-12 dark:[box-shadow:0_0_0_1px_var(--ck-line)]'
      } ${ERROR_ENTER}`}
    >
      <span
        aria-hidden="true"
        className={`flex size-14 items-center justify-center rounded-full ${store ? 'bg-surface text-ink' : 'bg-ck-soft text-ck-ink'}`}
      >
        <CheckoutIcon name="alert" className="size-7" />
      </span>
      <div className="flex flex-col gap-3">
        <h1
          className={
            store
              ? 'h2 text-balance'
              : `${CK_HEADING} text-[1.625rem]! text-balance sm:text-[1.875rem]!`
          }
        >
          {text.title}
        </h1>
        <p
          className={`mx-auto! max-w-[28rem] text-[1rem] text-pretty sm:text-[1.0625rem] ${store ? 'text-muted' : 'text-ck-muted'}`}
        >
          {text.body}
        </p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
        {store ? (
          <>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleRetry}
              disabled={retrying}
            >
              <span className="btn__label">{retrying ? copy.retrying : copy.retry}</span>
            </button>
            <a href={backHref} className="btn btn--secondary">
              <span className="btn__label">{text.secondary}</span>
            </a>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`${CK_BUTTON_PRIMARY} h-12! sm:w-auto sm:min-w-[10rem]`}
              onClick={handleRetry}
              disabled={retrying}
            >
              {retrying ? copy.retrying : copy.retry}
            </button>
            <a href={backHref} className={`${CK_BUTTON_SECONDARY} h-12! w-full sm:w-auto`}>
              {text.secondary}
            </a>
          </>
        )}
      </div>
      {contact || digest ? (
        <div
          className={`flex flex-col gap-1.5 text-[0.875rem] ${store ? 'text-muted' : 'text-ck-muted'}`}
        >
          {contact ? (
            <p>
              {copy.help}{' '}
              <a
                href={contact.href}
                {...(contact.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className={`font-medium underline underline-offset-4 ${store ? 'text-ink' : 'text-ck-ink!'}`}
              >
                {contact.label}
              </a>
            </p>
          ) : null}
          {digest ? <p className="text-[0.75rem] tabular-nums">{copy.reference(digest)}</p> : null}
        </div>
      ) : null}
    </div>
  )

  return store ? (
    <section className="page-width flex min-h-[60svh] items-center justify-center py-16 sm:py-24">
      {card}
    </section>
  ) : (
    <div
      className="ck flex min-h-dvh flex-col bg-ck-canvas font-ck text-[0.9375rem] leading-normal text-ck-ink antialiased"
      style={{ ...CK_FALLBACK_VARS, ...help?.vars } as CSSProperties}
    >
      <header className="border-b border-ck-line bg-ck-bg">
        <div className="mx-auto! flex min-h-16 w-full max-w-[72rem] items-center px-5 sm:px-8 lg:min-h-[4.5rem] [--ck-summary-ink:var(--ck-ink)]">
          {help ? (
            <CheckoutBrand
              storeName={help.storeName}
              logoUrl={help.logoUrl}
              href={backHref}
              label={text.secondary}
            />
          ) : null}
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8 sm:py-20">
        {card}
      </div>
    </div>
  )
}
