'use client'

import {
  allowedTags,
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  type Consent,
  encodeConsent,
  type StorePreferences,
} from '@commerce/core/preferences'
import { useState } from 'react'
import TrackingTags from '@/components/analytics/tracking-tags'
import { consentContent as copy } from '@/data/online-store'

type ConsentManagerProps = {
  privacy: StorePreferences['privacy']
  tracking: StorePreferences['tracking']
  /** The choice read from the cookie on the server; null until the shopper decides. */
  initial: Consent | null
}

const OPTIONAL = ['analytics', 'marketing'] as const

function remember(consent: Consent): void {
  const secure = window.location.protocol === 'https:' ? '; secure' : ''
  // biome-ignore lint/suspicious/noDocumentCookie: one first-party cookie; the Cookie Store API is not in Safari or Firefox.
  document.cookie = `${CONSENT_COOKIE}=${encodeConsent(consent)}; path=/; max-age=${CONSENT_MAX_AGE}; samesite=lax${secure}`
}

/**
 * The cookie banner (DPDP style: necessary always on, analytics and marketing by
 * choice) and the tags it gates. Shown only when the store runs a tag; tags load
 * the moment the matching category is allowed, without a reload.
 */
export default function ConsentManager({ privacy, tracking, initial }: ConsentManagerProps) {
  // Hooks
  const [consent, setConsent] = useState(initial)
  const [choosing, setChoosing] = useState(false)
  const [draft, setDraft] = useState<Consent>({ analytics: false, marketing: false })

  // Event handlers
  const handleChoose = (next: Consent) => {
    remember(next)
    setConsent(next)
    setChoosing(false)
  }

  // Render logic
  const tags = allowedTags({ privacy, tracking }, consent)
  const runsTags = Boolean(tracking.ga4 || tracking.gtm || tracking.metaPixel)
  const ask = privacy.bannerEnabled && runsTags && consent === null

  return (
    <>
      <TrackingTags {...tags} />
      {ask ? (
        <div className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex justify-center">
          <section
            aria-label={copy.label}
            className="pointer-events-auto flex w-full max-w-2xl flex-col gap-4 rounded-lg border border-line bg-surface p-5 text-ink shadow-lg"
          >
            <div className="flex flex-col gap-1">
              <p className="text-base font-semibold">{copy.heading}</p>
              <p className="text-sm text-muted">{privacy.message || copy.body}</p>
            </div>
            {choosing ? (
              <ul className="flex flex-col gap-3">
                <li className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked
                    disabled
                    className="mt-1"
                    aria-labelledby="c-necessary"
                  />
                  <span className="flex flex-col">
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
                      className="mt-1"
                    />
                    <label htmlFor={`c-${key}`} className="flex flex-col">
                      <span className="text-sm font-semibold">{copy.categories[key].label}</span>
                      <span className="text-sm text-muted">{copy.categories[key].body}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              {choosing ? (
                <button
                  type="button"
                  className="btn btn--secondary btn--small"
                  onClick={() => handleChoose(draft)}
                >
                  {copy.save}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--secondary btn--small"
                  onClick={() => setChoosing(true)}
                >
                  {copy.customise}
                </button>
              )}
              <button
                type="button"
                className="btn btn--secondary btn--small"
                onClick={() => handleChoose({ analytics: false, marketing: false })}
              >
                {copy.rejectAll}
              </button>
              <button
                type="button"
                className="btn btn--primary btn--small"
                onClick={() => handleChoose({ analytics: true, marketing: true })}
              >
                {copy.acceptAll}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
