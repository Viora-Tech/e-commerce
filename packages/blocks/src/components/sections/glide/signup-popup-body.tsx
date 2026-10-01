'use client'

import { type CSSProperties, type ReactNode, useActionState, useEffect, useState } from 'react'
import { signupPopupContent as copy } from '../../../data/glide/signup-popup'
import type { PopupStyle } from '../../../sections/glide/signup-popup'
import type { CardProduct } from '../../../types'
import Picture from '../../picture'
import type { NewsletterAction, NewsletterState } from '../newsletter'

type SignupPopupBodyProps = {
  style: PopupStyle
  headingId: string
  kicker: ReactNode
  heading: ReactNode
  text: ReactNode
  buttonLabel: ReactNode
  finePrint: ReactNode
  successHeading: ReactNode
  successText: ReactNode
  discountCode: string
  feed: CardProduct[]
  action?: NewsletterAction | undefined
  /** Called once the action accepted the address. */
  onDone: () => void
}

const idle: NewsletterState = { status: 'idle' }
const noop: NewsletterAction = async () => ({ status: 'error' })

/** "Get [₹100 off]": a bracketed word is coloured. Editor nodes render as they are. */
function accented(value: ReactNode): ReactNode {
  if (typeof value !== 'string') return value
  return value.split(/(\[[^\]]*\])/).map((part, i) =>
    part.startsWith('[') && part.endsWith(']') ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: fixed pieces of one heading.
      <em key={i}>{part.slice(1, -1)}</em>
    ) : (
      part
    ),
  )
}

// The popup's kicker, drop feed and form (sections/signup-popup.liquid), shared by all looks.
export default function SignupPopupBody({
  style,
  headingId,
  kicker,
  heading,
  text,
  buttonLabel,
  finePrint,
  successHeading,
  successText,
  discountCode,
  feed,
  action,
  onDone,
}: SignupPopupBodyProps) {
  // Hooks
  const [state, submit, pending] = useActionState(action ?? noop, idle)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (state.status === 'done') onDone()
  }, [state.status, onDone])

  // Event handlers
  const handleCopy = () => {
    const done = () => setCopied(true)
    try {
      navigator.clipboard.writeText(discountCode).then(done, done)
    } catch {
      done()
    }
  }

  // Render logic
  const done = state.status === 'done'

  return (
    <div className="signup-popup__body">
      {kicker ? (
        <span className="signup-popup__kicker">
          <i aria-hidden="true" />
          {kicker}
        </span>
      ) : null}
      {style === 'feed' && feed.length > 0 ? (
        <ul className="signup-popup__feed">
          {feed.map((p, i) => {
            const live = p.available > 0
            const image = p.images[0]
            return (
              <li
                key={p.id}
                className="signup-popup__feed-item"
                style={{ '--i': i } as CSSProperties}
              >
                <a href={`/products/${p.handle}`}>
                  {image ? (
                    <Picture image={image} alt="" sizes="2.375rem" loading="lazy" />
                  ) : (
                    <span />
                  )}
                  <span>
                    <strong>{p.title}</strong>
                    <small>{live ? copy.feedSubs.live : copy.feedSubs.soon}</small>
                  </span>
                  <span
                    className={`signup-popup__tag signup-popup__tag--${live ? 'live' : 'soon'}`}
                  >
                    {live ? copy.feedTags.live : copy.feedTags.soon}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      ) : null}
      {done ? (
        <div className="signup-popup__done" role="status">
          <h2 className="signup-popup__heading" id={headingId}>
            {accented(successHeading)}
          </h2>
          <p className="signup-popup__text">{copy.confirmNote}</p>
          {discountCode ? (
            <>
              <p className="signup-popup__text">{successText}</p>
              <div className="signup-popup__code">
                <span>{discountCode}</span>
                <button type="button" onClick={handleCopy}>
                  {copied ? copy.copied : copy.copy}
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <form className="signup-popup__form" action={submit}>
          <h2 className="signup-popup__heading" id={headingId}>
            {accented(heading)}
          </h2>
          {text ? <p className="signup-popup__text">{text}</p> : null}
          {state.status === 'error' ? (
            <p className="signup-popup__error" role="alert">
              {copy.failed}
            </p>
          ) : null}
          <div className="signup-popup__field">
            <label htmlFor={`${headingId}-email`} className="visually-hidden">
              {copy.emailLabel}
            </label>
            <input
              id={`${headingId}-email`}
              type="email"
              name="email"
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              placeholder={copy.emailPlaceholder}
              required
            />
            <button type="submit" className="btn btn--primary" disabled={pending}>
              <span>{buttonLabel}</span>
            </button>
          </div>
          {finePrint ? <p className="signup-popup__fine">{finePrint}</p> : null}
        </form>
      )}
    </div>
  )
}
