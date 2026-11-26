'use client'

import type { NotifyMeWidget } from '@commerce/blocks'
import PhoneInput from '@commerce/blocks/phone-input-lazy'
import { type FormEvent, useActionState, useState } from 'react'
import { backInStockContent as content } from '@/data/back-in-stock'
import { type NotifyMeState, notifyMeAction } from '@/lib/back-in-stock-actions'

type NotifyMeFieldsProps = {
  variantId: string
  whatsappEnabled: boolean
  /** The campaign's words and look; null draws the plain form (an app without a campaign yet). */
  widget: NotifyMeWidget | null
  /** The submit button's words when there is no widget ("Notify me"). */
  buttonText?: string | null | undefined
  /** Drawn in the pop-up: the theme's sold-out panel rules don't reach there, so utilities do. */
  popup?: boolean | undefined
}

const idle: NotifyMeState = { status: 'idle' }

/** Class names in the sold-out panel (theme rules) and in the pop-up (utilities, Essential's look). */
const CLASSES = {
  panel: {
    form: 'product-notify__form',
    fields: 'product-notify__fields',
    field: 'product-notify__field',
    label: 'product-notify__label',
    input: 'product-notify__input',
    submit: 'btn btn--primary product-notify__submit',
    note: 'product-notify__note text-caption',
    error: 'product-notify__error',
    success: 'product-notify__success grid gap-1',
  },
  popup: {
    form: 'm-0 grid gap-3',
    fields: 'grid gap-3',
    field: 'grid gap-1',
    label: 'sr-only',
    input:
      'w-full rounded-none border border-current/25 bg-transparent px-3 py-3 text-base text-inherit placeholder:opacity-60 focus-visible:outline-2 focus-visible:outline-current',
    submit: 'btn btn--primary w-full',
    note: 'm-0 text-xs opacity-70',
    error: 'm-0 text-sm text-red-500',
    success: 'grid gap-1',
  },
} as const
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * The sold-out signup form: email, the WhatsApp number when the store asks for one, the
 * newsletter checkbox when the campaign offers it, then the campaign's Notify me button and
 * disclaimer. On success it swaps itself for the campaign's "Thank you!" heading and message.
 */
export default function NotifyMeFields({
  variantId,
  whatsappEnabled,
  widget,
  buttonText,
  popup,
}: NotifyMeFieldsProps) {
  // Hooks
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [badEmail, setBadEmail] = useState(false)
  const [state, submit, pending] = useActionState(
    (s: NotifyMeState, form: FormData) => notifyMeAction(variantId, s, form),
    idle,
  )

  // Event handlers
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    // Essential checks the address before sending; a WhatsApp number alone is fine too.
    const ok = EMAIL.test(email.trim()) || (whatsappEnabled && phone.length > 6 && !email.trim())
    setBadEmail(!ok)
    if (!ok) e.preventDefault()
  }

  // Early returns
  const c = CLASSES[popup ? 'popup' : 'panel']
  if (state.status === 'done') {
    return (
      <div className={c.success} role="status" data-done>
        {widget ? <p className="m-0 text-xl font-medium">{widget.successHeading}</p> : null}
        <p className="m-0 font-normal">{widget ? widget.successMessage : content.doneEmail}</p>
      </div>
    )
  }

  // Render logic
  const errorText =
    state.status === 'error' && state.error?.startsWith('rate_limited')
      ? content.errorRateLimited
      : content.errorGeneric
  const label = widget?.submitText || buttonText || content.submit

  return (
    <form className={c.form} action={submit} onSubmit={handleSubmit} noValidate>
      <div className={c.fields}>
        <div className={c.field}>
          <label className={c.label} htmlFor={`notify-me-email-${variantId}`}>
            {content.emailLabel}
          </label>
          <input
            id={`notify-me-email-${variantId}`}
            className={c.input}
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={badEmail || undefined}
            placeholder={widget?.emailPlaceholder || content.emailPlaceholder}
          />
          {badEmail ? (
            <p className={c.error} role="alert">
              {widget?.emailError || content.emailInvalid}
            </p>
          ) : null}
        </div>
        {whatsappEnabled ? (
          <div className={c.field}>
            <label className={c.label} htmlFor={`notify-me-phone-${variantId}`}>
              {content.whatsappLabel}
            </label>
            <PhoneInput
              id={`notify-me-phone-${variantId}`}
              autoComplete="tel"
              placeholder={content.whatsappPlaceholder}
              value={phone}
              onChange={setPhone}
            />
            <input type="hidden" name="phone" value={phone} />
          </div>
        ) : null}
        {widget?.newsletter ? (
          <label className="flex items-start gap-2 text-sm text-(--color-muted)">
            <input
              type="checkbox"
              name="newsletter"
              className="mt-0.5 size-4 shrink-0 accent-(--color-ink)"
              defaultChecked={widget.newsletterPrechecked}
            />
            <span>{widget.newsletterText}</span>
          </label>
        ) : null}
      </div>
      <button className={c.submit} type="submit" disabled={pending}>
        <span>{pending ? content.submitting : label}</span>
      </button>
      {widget ? (
        widget.disclaimer ? (
          <p className={c.note}>{widget.disclaimer}</p>
        ) : null
      ) : (
        <p className={c.note}>{content.consent}</p>
      )}
      {state.status === 'error' ? (
        <p className={c.error} role="alert">
          {errorText}
        </p>
      ) : null}
    </form>
  )
}
