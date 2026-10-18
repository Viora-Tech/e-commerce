'use client'

import { type ReactNode, useActionState, useId } from 'react'
import { footerContent as copy } from '../data/zero-drift/footer'
import type { NewsletterAction, NewsletterState } from './sections/newsletter'

type FooterNewsletterProps = {
  heading: ReactNode
  button: ReactNode
  /** The storefront's signup action; the editor canvas has none and the form does nothing. */
  action?: NewsletterAction | undefined
}

const idle: NewsletterState = { status: 'idle' }
const noop: NewsletterAction = async () => idle

/** The footer's email sign-up (Figma Section / Footer, "Get drops first"): one field and a button. */
export default function FooterNewsletter({ heading, button, action }: FooterNewsletterProps) {
  // Hooks
  const id = useId()
  const [state, submit, pending] = useActionState(action ?? noop, idle)

  // Render logic
  const emailId = `${id}-email`
  const failed = state.status === 'error'

  return (
    <div className="footer__block footer__block--newsletter">
      <p className="footer__heading">{heading}</p>
      {state.status === 'done' ? (
        <p className="footer__newsletter-note" role="status">
          {copy.newsletterDone}
        </p>
      ) : (
        <form className="footer__newsletter-form" action={submit}>
          <label className="visually-hidden" htmlFor={emailId}>
            {copy.newsletterLabel}
          </label>
          <input
            id={emailId}
            className="footer__newsletter-input"
            type="email"
            name="email"
            required
            autoComplete="email"
            autoCapitalize="off"
            autoCorrect="off"
            placeholder={copy.newsletterPlaceholder}
            aria-invalid={failed ? true : undefined}
          />
          <button
            className="btn btn--primary footer__newsletter-submit"
            type="submit"
            disabled={pending}
          >
            {button}
          </button>
        </form>
      )}
      {failed ? (
        <p className="footer__newsletter-note footer__newsletter-note--error" role="alert">
          {copy.newsletterFailed}
        </p>
      ) : null}
    </div>
  )
}
