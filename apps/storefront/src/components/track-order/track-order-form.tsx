'use client'

import { useActionState, useId } from 'react'
import { trackOrderContent as copy } from '@/data/track-order'
import { type TrackOrderState, trackOrderAction } from '@/lib/track-order-actions'

const idle: TrackOrderState = { status: 'idle' }

/**
 * Figma Pages · Track order "Lookup" (707:117741): a surface card with the order number and the
 * email or mobile it was placed with; a match opens the order's status page.
 */
export default function TrackOrderForm() {
  // Hooks
  const id = useId()
  const [state, submit, pending] = useActionState(trackOrderAction, idle)

  // Render logic
  const error =
    state.status === 'not-found' ? copy.notFound : state.status === 'limited' ? copy.limited : null

  return (
    <form action={submit} className="track-order">
      <div className="track-order__head">
        <h1 className="track-order__title">{copy.title}</h1>
        <p className="track-order__body">{copy.body}</p>
      </div>
      <label className="track-order__field" htmlFor={`${id}-number`}>
        <span className="track-order__label">{copy.number}</span>
        <input
          id={`${id}-number`}
          name="number"
          className="track-order__input"
          inputMode="numeric"
          autoComplete="off"
          placeholder={copy.numberPlaceholder}
          required
        />
      </label>
      <label className="track-order__field" htmlFor={`${id}-contact`}>
        <span className="track-order__label">{copy.contact}</span>
        <input
          id={`${id}-contact`}
          name="contact"
          className="track-order__input"
          autoComplete="email"
          placeholder={copy.contactPlaceholder}
          required
        />
      </label>
      {error ? (
        <p className="track-order__error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn--primary track-order__submit" disabled={pending}>
        {pending ? copy.checking : copy.submit}
      </button>
      <p className="track-order__account">
        {copy.account} <a href="/account">{copy.signIn}</a>
      </p>
    </form>
  )
}
