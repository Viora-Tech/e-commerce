'use client'

import PhoneInput from '@commerce/blocks/phone-input-lazy'
import { useActionState, useState } from 'react'
import { backInStockContent as content } from '@/data/back-in-stock'
import { type NotifyMeState, notifyMeAction } from '@/lib/back-in-stock-actions'

type NotifyMeFormProps = {
  variantId: string
  whatsappEnabled: boolean
  /** The app's "Button text" setting; null keeps "Notify me". */
  buttonText?: string | null | undefined
}

const idle: NotifyMeState = { status: 'idle' }

/**
 * Sold-out variant, not on pre-order: ask for an email (and optionally WhatsApp) alert. Drawn
 * inside the buy box's sold-out panel (`product-notify`), which carries the heading.
 */
export default function NotifyMeForm({
  variantId,
  whatsappEnabled,
  buttonText,
}: NotifyMeFormProps) {
  // Hooks
  const [phone, setPhone] = useState('')
  const [state, submit, pending] = useActionState(
    (s: NotifyMeState, form: FormData) => notifyMeAction(variantId, s, form),
    idle,
  )

  // Render logic
  const errorText =
    state.status === 'error' && state.error?.startsWith('rate_limited')
      ? content.errorRateLimited
      : content.errorGeneric

  if (state.status === 'done') {
    return (
      <p className="product-notify__success" role="status">
        {content.doneEmail}
      </p>
    )
  }

  return (
    <form className="product-notify__form" action={submit}>
      <div className="product-notify__fields">
        <div className="product-notify__field">
          <label className="product-notify__label" htmlFor="notify-me-email">
            {content.emailLabel}
          </label>
          <input
            id="notify-me-email"
            className="product-notify__input"
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder={content.emailPlaceholder}
          />
        </div>
        {whatsappEnabled ? (
          <div className="product-notify__field">
            <label className="product-notify__label" htmlFor="notify-me-phone">
              {content.whatsappLabel}
            </label>
            <PhoneInput
              id="notify-me-phone"
              autoComplete="tel"
              placeholder={content.whatsappPlaceholder}
              value={phone}
              onChange={setPhone}
            />
            <input type="hidden" name="phone" value={phone} />
          </div>
        ) : null}
      </div>
      <button className="btn btn--primary product-notify__submit" type="submit" disabled={pending}>
        <span>{pending ? content.submitting : buttonText || content.submit}</span>
      </button>
      <p className="product-notify__note text-caption">{content.consent}</p>
      {state.status === 'error' ? (
        <p className="product-notify__error" role="alert">
          {errorText}
        </p>
      ) : null}
    </form>
  )
}
