'use client'

import { type ReactNode, useActionState, useId } from 'react'
import { sectionsContent } from '../../data/sections'
import { newsletterContent } from '../../data/zero-drift/newsletter'
import Meteors from '../../effects/meteors'
import Icon, { type IconName } from '../icon'
import RichCopy from '../rich-copy'

/** The storefront's signup action: sends a confirm link; consent starts when it is opened. */
export type NewsletterAction = (state: NewsletterState, form: FormData) => Promise<NewsletterState>

export type NewsletterState = { status: 'idle' | 'done' | 'error' }

type NewsletterProps = {
  eyebrow?: ReactNode
  heading: ReactNode
  text: ReactNode
  button: ReactNode
  reassurance?: ReactNode
  /** What to hear about, as chips. Sent along as `interest` fields; the action keeps only the email today. */
  interests?: { label: ReactNode; tag: string }[] | undefined
  reasons?: { icon: IconName; text: ReactNode }[] | undefined
  action?: NewsletterAction | undefined
}

const copy = sectionsContent.newsletter
const idle: NewsletterState = { status: 'idle' }
const noop: NewsletterAction = async () => ({ status: 'error' })

/** Ledger numbering, as Glide prints it: 01, 02, ... */
const ordinal = (index: number) => String(index + 1).padStart(2, '0')

// Port of sections/newsletter.liquid: a rounded card with the pitch and reasons on the
// left, interests and the email capture on the right, Aceternity meteors behind it.
export default function Newsletter({
  eyebrow,
  heading,
  text,
  button,
  reassurance,
  interests = [],
  reasons = [],
  action,
}: NewsletterProps) {
  // Hooks
  const id = useId()
  const [state, submit, pending] = useActionState(action ?? noop, idle)

  // Render logic
  const emailId = `${id}-email`
  const errorId = `${id}-error`
  const failed = state.status === 'error'

  return (
    <div className="newsletter">
      <div className="newsletter__card relative isolate overflow-hidden">
        <Meteors />
        <div className="newsletter__copy">
          {eyebrow ? (
            <p className="newsletter__eyebrow">
              <span className="newsletter__eyebrow-dot" aria-hidden="true" />
              {eyebrow}
            </p>
          ) : null}
          {heading ? <h2 className="newsletter__heading h2">{heading}</h2> : null}
          <RichCopy value={text} className="newsletter__text text-body" />
          {reasons.length > 0 ? (
            <ul className="newsletter__reasons">
              {reasons.map((r, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: reasons have no id; the editor reorders by position.
                <li key={i} className="newsletter__reason">
                  <span className="newsletter__reason-num" aria-hidden="true">
                    {ordinal(i)}
                  </span>
                  <span className="newsletter__reason-text">{r.text}</span>
                  <span className="newsletter__reason-icon" aria-hidden="true">
                    <Icon name={r.icon} size={16} />
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="newsletter__form-wrapper">
          {state.status === 'done' ? (
            <p className="newsletter__message newsletter__message--success" role="status">
              <Icon name="guaranteed" size={20} />
              <span>{copy.done}</span>
            </p>
          ) : (
            <form className="newsletter__form" action={submit}>
              {failed ? (
                <p
                  id={errorId}
                  className="newsletter__message newsletter__message--error"
                  role="alert"
                >
                  <Icon name="close" size={16} />
                  <span>{copy.failed}</span>
                </p>
              ) : null}
              {interests.length > 0 ? (
                <fieldset className="newsletter__interests">
                  <legend className="newsletter__interests-legend text-small">
                    {newsletterContent.interestsLegend}
                  </legend>
                  {interests.map((interest, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: interests have no id; the editor reorders by position.
                    <label key={i} className="newsletter__interest">
                      <input type="checkbox" name="interest" value={interest.tag} />
                      <span>{interest.label}</span>
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <div className="newsletter__field">
                <label className="visually-hidden" htmlFor={emailId}>
                  {copy.label}
                </label>
                <input
                  id={emailId}
                  className="newsletter__input"
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                  placeholder={copy.placeholder}
                  aria-invalid={failed ? true : undefined}
                  aria-describedby={failed ? errorId : undefined}
                />
                <button className="newsletter__submit" type="submit" disabled={pending}>
                  <span>{button}</span>
                </button>
              </div>
              {reassurance ? (
                <p className="newsletter__reassurance text-caption">{reassurance}</p>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
