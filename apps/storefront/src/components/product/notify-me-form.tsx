'use client'

import { useActionState } from 'react'
import { backInStockContent as content } from '@/data/back-in-stock'
import { type NotifyMeState, notifyMeAction } from '@/lib/back-in-stock-actions'

type NotifyMeFormProps = {
  storeId: string
  variantId: string
  whatsappEnabled: boolean
}

const idle: NotifyMeState = { status: 'idle' }

/** Sold-out variant, not on pre-order: ask for an email (and optionally WhatsApp) alert. */
export default function NotifyMeForm({ storeId, variantId, whatsappEnabled }: NotifyMeFormProps) {
  // Hooks
  const [state, submit, pending] = useActionState(
    (s: NotifyMeState, form: FormData) => notifyMeAction(storeId, variantId, s, form),
    idle,
  )

  // Render logic
  const errorText =
    state.status === 'error' && state.error?.startsWith('rate_limited')
      ? content.errorRateLimited
      : content.errorGeneric

  if (state.status === 'done') {
    return (
      <p className="notify-me__message text-body" role="status">
        {content.doneEmail}
      </p>
    )
  }

  return (
    <div className="notify-me">
      <p className="notify-me__heading text-caption">{content.heading}</p>
      <form className="notify-me__form" action={submit}>
        <label className="visually-hidden" htmlFor="notify-me-email">
          {content.emailLabel}
        </label>
        <input
          id="notify-me-email"
          className="field__input"
          type="email"
          name="email"
          autoComplete="email"
          placeholder={content.emailPlaceholder}
        />
        {whatsappEnabled ? (
          <>
            <label className="visually-hidden" htmlFor="notify-me-phone">
              {content.whatsappLabel}
            </label>
            <input
              id="notify-me-phone"
              className="field__input"
              type="tel"
              name="phone"
              inputMode="numeric"
              autoComplete="tel"
              placeholder={content.whatsappPlaceholder}
            />
          </>
        ) : null}
        <p className="notify-me__consent text-small">{content.consent}</p>
        <button className="btn btn--primary" type="submit" disabled={pending}>
          {pending ? content.submitting : content.submit}
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
