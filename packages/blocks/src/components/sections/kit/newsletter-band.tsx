'use client'

// Pattern after common inline email-capture bands (our own implementation). The signup itself is
// the storefront's own action, the same one the Email signup section uses. See
// THIRD_PARTY_NOTICES.md.
import { type ReactNode, useActionState, useId } from 'react'
import { sectionsContent } from '../../../data/sections'
import Icon from '../../icon'
import RichCopy from '../../rich-copy'
import type { NewsletterAction, NewsletterState } from '../newsletter'

/** Copy is a string in storage, a React node while edited on the canvas. */
type NewsletterBandProps = {
  heading: ReactNode
  text: ReactNode
  button: ReactNode
  reassurance: ReactNode
  /** The storefront's subscribe action (section metadata); absent in previews and the editor. */
  action?: NewsletterAction | undefined
}

const copy = sectionsContent.newsletter
const idle: NewsletterState = { status: 'idle' }
const noop: NewsletterAction = async () => ({ status: 'error' })

const DOTS =
  'radial-gradient(circle,color-mix(in oklab,var(--color-brand) 22%,transparent) 1px,transparent 1px)'

/** A brand-tinted band: the offer on one side, the email field on the other. */
export default function NewsletterBand({
  heading,
  text,
  button,
  reassurance,
  action,
}: NewsletterBandProps) {
  // Hooks
  const id = useId()
  const [state, submit, pending] = useActionState(action ?? noop, idle)

  // Render logic
  const emailId = `${id}-email`
  const errorId = `${id}-error`
  const failed = state.status === 'error'

  return (
    <div className="page-width">
      <div className="relative isolate grid grid-cols-1 items-center gap-[1.5rem] overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-brand)_7%,var(--color-surface))] p-[1.75rem] text-left md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-[3rem] md:p-[3rem]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_left,black,transparent_70%)]"
          style={{ backgroundImage: DOTS, backgroundSize: '1rem 1rem' }}
        />
        <div className="flex flex-col gap-[0.75rem]">
          {heading ? <h2 className="h3 text-balance text-[var(--color-ink)]">{heading}</h2> : null}
          <RichCopy value={text} className="text-body text-[var(--color-muted)]" />
        </div>
        {state.status === 'done' ? (
          <p
            role="status"
            className="flex items-center gap-[0.5rem] text-body text-[var(--color-ink)]"
          >
            <Icon name="guaranteed" size={20} />
            <span>{copy.done}</span>
          </p>
        ) : (
          <form action={submit} className="flex flex-col gap-[0.625rem]">
            {failed ? (
              <p id={errorId} role="alert" className="text-small text-[var(--color-danger)]">
                {copy.failed}
              </p>
            ) : null}
            <div className="flex flex-col gap-[0.5rem] sm:flex-row">
              <label className="visually-hidden" htmlFor={emailId}>
                {copy.label}
              </label>
              <input
                id={emailId}
                className="field__input min-w-0 flex-1"
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
              <button className="btn btn--primary shrink-0" type="submit" disabled={pending}>
                <span>{button}</span>
              </button>
            </div>
            {reassurance ? (
              <p className="text-caption text-[var(--color-muted)]">{reassurance}</p>
            ) : null}
          </form>
        )}
      </div>
    </div>
  )
}
