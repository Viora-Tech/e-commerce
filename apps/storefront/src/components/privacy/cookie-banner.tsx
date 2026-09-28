'use client'

import type { Consent } from '@commerce/core/preferences'
import { useState } from 'react'
import { consentContent as copy } from '@/data/online-store'

type CookieBannerProps = {
  /** The store's own wording; empty for the default. */
  message: string
  /** Pre-ticked categories when choosing: everything off at first, the current choice when reopened. */
  initial: Consent
  /** Open straight on the category list (reopened from Cookie settings). */
  startChoosing: boolean
  onChoose: (consent: Consent) => void
}

const OPTIONAL = ['analytics', 'marketing'] as const

/* `.btn` never wraps its label and `.btn--small` has a fixed height, so buttons grow to
   share a row and drop to the next one when their labels do not fit side by side. */
const BUTTON = 'btn btn--small min-w-fit grow basis-32'

/**
 * The banner itself: equal weight for "Necessary only" and "Accept all", and a
 * category list where every optional box starts unticked. On phones it spans the width
 * above the safe area with a side gutter; from `sm` it is a compact card in the bottom-left
 * corner (chat and cart buttons usually take the right).
 */
export default function CookieBanner({
  message,
  initial,
  startChoosing,
  onChoose,
}: CookieBannerProps) {
  // Hooks
  const [choosing, setChoosing] = useState(startChoosing)
  const [draft, setDraft] = useState<Consent>(initial)

  // Render logic
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex justify-center sm:inset-x-auto sm:bottom-5 sm:left-5 sm:justify-start">
      <section
        aria-label={copy.label}
        className="pointer-events-auto flex max-h-[min(80dvh,36rem)] w-full min-w-0 flex-col gap-4 overflow-y-auto overscroll-contain rounded-lg border border-line bg-surface p-4 text-ink shadow-lg [overflow-wrap:anywhere] sm:w-[24rem] sm:p-5"
      >
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold">{copy.heading}</p>
          <p className="text-sm text-muted">{message || copy.body}</p>
        </div>
        {choosing ? (
          <ul className="flex flex-col gap-3">
            <li className="flex items-start gap-3">
              <input
                type="checkbox"
                checked
                disabled
                className="mt-1 shrink-0"
                aria-labelledby="c-necessary"
              />
              <span className="flex min-w-0 flex-col">
                <span id="c-necessary" className="text-sm font-semibold">
                  {copy.categories.necessary.label}
                </span>
                <span className="text-sm text-muted">{copy.categories.necessary.body}</span>
              </span>
            </li>
            {OPTIONAL.map((key) => (
              <li key={key} className="flex items-start gap-3">
                <input
                  id={`c-${key}`}
                  type="checkbox"
                  checked={draft[key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.checked }))}
                  className="mt-1 shrink-0"
                />
                <label htmlFor={`c-${key}`} className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold">{copy.categories[key].label}</span>
                  <span className="text-sm text-muted">{copy.categories[key].body}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {choosing ? (
            <button
              type="button"
              className={`${BUTTON} btn--secondary`}
              onClick={() => onChoose(draft)}
            >
              {copy.save}
            </button>
          ) : (
            <button
              type="button"
              className={`${BUTTON} btn--secondary`}
              onClick={() => setChoosing(true)}
            >
              {copy.customise}
            </button>
          )}
          <button
            type="button"
            className={`${BUTTON} btn--secondary`}
            onClick={() => onChoose({ analytics: false, marketing: false })}
          >
            {copy.rejectAll}
          </button>
          <button
            type="button"
            className={`${BUTTON} btn--primary`}
            onClick={() => onChoose({ analytics: true, marketing: true })}
          >
            {copy.acceptAll}
          </button>
        </div>
      </section>
    </div>
  )
}
