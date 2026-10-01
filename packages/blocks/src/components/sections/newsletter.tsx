'use client'

import { useActionState } from 'react'
import { sectionsContent } from '../../data/sections'

/** The storefront's signup action: sends a confirm link; consent starts when it is opened. */
export type NewsletterAction = (state: NewsletterState, form: FormData) => Promise<NewsletterState>

export type NewsletterState = { status: 'idle' | 'done' | 'error' }

type Props = {
  heading: string
  text: string
  button: string
  action?: NewsletterAction | undefined
}

const copy = sectionsContent.newsletter
const idle: NewsletterState = { status: 'idle' }
const noop: NewsletterAction = async () => ({ status: 'error' })

// Port of sections/newsletter.liquid: heading, blurb and an inline email form.
export default function Newsletter({ heading, text, button, action }: Props) {
  // Hooks
  const [state, submit, pending] = useActionState(action ?? noop, idle)

  return (
    <div className="newsletter page-width">
      {heading ? <h2 className="h2">{heading}</h2> : null}
      {text ? <p className="text-body">{text}</p> : null}
      {state.status === 'done' ? (
        <p className="newsletter__message text-body" role="status">
          {copy.done}
        </p>
      ) : (
        <form className="newsletter__form" action={submit}>
          <label className="visually-hidden" htmlFor="newsletter-email">
            {copy.label}
          </label>
          <input
            id="newsletter-email"
            className="field__input newsletter__input"
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder={copy.placeholder}
          />
          <button className="btn btn--primary" type="submit" disabled={pending}>
            {button}
          </button>
        </form>
      )}
      {state.status === 'error' ? (
        <p className="newsletter__message text-small" role="alert">
          {copy.failed}
        </p>
      ) : null}
    </div>
  )
}
