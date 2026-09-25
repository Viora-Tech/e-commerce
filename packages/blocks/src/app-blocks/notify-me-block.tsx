'use client'

import { useActionState } from 'react'

type NotifyMeActionState = { status: 'idle' | 'done' | 'error'; error?: string }

/**
 * What the storefront hands this block through `puck.metadata.appBlockContext.notifyMe`
 * (set by the product page route, the same "metadata carries what a block cannot load
 * on its own" pattern as `SectionMetadata.renderers`). `action` is the plugin's real
 * subscribe flow (`createSignup`), bound to the store by the route the same way
 * `newsletterAction` is.
 */
export type NotifyMeBlockContext = {
  variantId: string
  available: number
  isPreorder: boolean
  whatsappEnabled: boolean
  action: (
    variantId: string,
    state: NotifyMeActionState,
    form: FormData,
  ) => Promise<NotifyMeActionState>
}

export type NotifyMeBlockCopy = {
  emailLabel: string
  emailPlaceholder: string
  whatsappLabel: string
  whatsappPlaceholder: string
  consent: string
  submitting: string
  doneEmail: string
  errorGeneric: string
  errorRateLimited: string
}

type NotifyMeBlockProps = {
  buttonLabel: string
  helperText: string
  align: 'left' | 'center'
  /** Undefined when the block is placed on a template with no product (e.g. a page), or
   *  before the storefront route sets it up; the block quietly draws nothing then. */
  context: NotifyMeBlockContext | undefined
  copy: NotifyMeBlockCopy
}

const idle: NotifyMeActionState = { status: 'idle' }

/**
 * App block version of the back-in-stock "notify me" form (Add panel → Apps),
 * for merchants who want the sold-out capture somewhere other than the buy
 * box. Tracks the variant the product page resolved at render time; unlike
 * the buy box's built-in form it does not follow the shopper's live variant
 * picker, so it fits best on a page that only shows one variant's state.
 */
export default function NotifyMeBlock({
  buttonLabel,
  helperText,
  align,
  context,
  copy,
}: NotifyMeBlockProps) {
  // Hooks
  const [state, submit, pending] = useActionState(
    (s: NotifyMeActionState, form: FormData) =>
      context ? context.action(context.variantId, s, form) : Promise.resolve(s),
    idle,
  )

  // Early returns
  if (!context || context.isPreorder || context.available > 0) return null
  if (state.status === 'done') {
    return (
      <p className="notify-me__message text-body" role="status">
        {copy.doneEmail}
      </p>
    )
  }

  // Render logic
  const errorText =
    state.status === 'error' && state.error?.startsWith('rate_limited')
      ? copy.errorRateLimited
      : copy.errorGeneric

  return (
    <div key={context.variantId} className={`notify-me app-block-align app-block-align--${align}`}>
      <p className="notify-me__heading text-caption">{helperText}</p>
      <form className="notify-me__form" action={submit}>
        <label className="visually-hidden" htmlFor="app-notify-me-email">
          {copy.emailLabel}
        </label>
        <input
          id="app-notify-me-email"
          className="field__input"
          type="email"
          name="email"
          autoComplete="email"
          placeholder={copy.emailPlaceholder}
        />
        {context.whatsappEnabled ? (
          <>
            <label className="visually-hidden" htmlFor="app-notify-me-phone">
              {copy.whatsappLabel}
            </label>
            <input
              id="app-notify-me-phone"
              className="field__input"
              type="tel"
              name="phone"
              inputMode="numeric"
              autoComplete="tel"
              placeholder={copy.whatsappPlaceholder}
            />
          </>
        ) : null}
        <p className="notify-me__consent text-small">{copy.consent}</p>
        <button className="btn btn--primary" type="submit" disabled={pending}>
          {pending ? copy.submitting : buttonLabel}
        </button>
      </form>
      {state.status === 'error' ? (
        <p className="notify-me__message text-small" role="alert">
          {errorText}
        </p>
      ) : null}
    </div>
  )
}
