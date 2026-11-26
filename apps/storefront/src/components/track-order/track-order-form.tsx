'use client'

import { useActionState, useId } from 'react'
import { trackOrderContent as copy } from '@/data/track-order'
import { type TrackOrderState, trackOrderAction } from '@/lib/track-order-actions'

type TrackOrderFormProps = {
  /** Under a signed-in shopper's recent orders: "Track another order", a second-level heading. */
  another?: boolean
  /** A shopper already signed in is not asked to sign in. */
  signedIn?: boolean
}

const idle: TrackOrderState = { status: 'idle' }

/**
 * Figma Pages · Track order "Lookup" (707:117741): a surface card with the order number and the
 * email or mobile it was placed with; a match opens the order's status page.
 */
export default function TrackOrderForm({ another = false, signedIn = false }: TrackOrderFormProps) {
  // Hooks
  const id = useId()
  const [state, submit, pending] = useActionState(trackOrderAction, idle)

  // Render logic
  const error =
    state.status === 'not-found' ? copy.notFound : state.status === 'limited' ? copy.limited : null
  const Heading = another ? 'h2' : 'h1'

  return (
    <form action={submit} className={another ? 'track-order w-full!' : 'track-order'}>
      <div className="track-order__head">
        <Heading className="track-order__title">
          {another ? copy.another.title : copy.title}
        </Heading>
        <p className="track-order__body">{another ? copy.another.body : copy.body}</p>
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
      {signedIn ? null : (
        <p className="track-order__account">
          {copy.account} <a href="/account">{copy.signIn}</a>
        </p>
      )}
    </form>
  )
}
