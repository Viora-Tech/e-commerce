'use client'

// Port of sections/cookie-banner.liquid (+ assets/cookie-banner.js): the consent banner's look.
// It only asks; the storefront's ConsentManager records the answer and loads what it allows.
import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { cookieBannerContent } from '../../../data/glide/cookie-banner'
import type { CookieBannerSettings } from '../../../sections/glide/cookie-banner'
import { safeHref } from '../../../slot-types'
import RichCopy from '../../rich-copy'

type Choice = { analytics: boolean; marketing: boolean }
type Labels = {
  save: string
  categories: Record<'necessary' | 'analytics' | 'marketing', { label: string; body: string }>
}

type CookieBannerProps = CookieBannerSettings & {
  /** Settings → Customer privacy wording; when set it replaces the section's message. */
  storeMessage?: string | undefined
  /** Pre-ticked categories when choosing: all off at first, the current choice when reopened. */
  initial?: Choice | undefined
  /** Open straight on the category list (reopened from Cookie settings), with no delay. */
  startChoosing?: boolean | undefined
  /** Records the answer. Without it the banner is a static picture (the Customize canvas). */
  onChoose?: ((choice: Choice) => void) | undefined
  /** The storefront's category wording, so the legal text has one source. */
  labels?: Labels | undefined
}

const OPTIONAL = ['analytics', 'marketing'] as const
const NONE: Choice = { analytics: false, marketing: false }
const ALL: Choice = { analytics: true, marketing: true }
const SECOND_MS = 1000

/** A label the merchant cleared still needs words: consent buttons must say what they do. */
const orDefault = (value: ReactNode, fallback: string) =>
  value === '' || value === null || value === undefined ? fallback : value

export default function CookieBanner({
  position,
  message,
  policyLink,
  policyLabel,
  acceptLabel,
  declineLabel,
  showPreferences,
  preferencesLabel,
  delay,
  storeMessage,
  initial = NONE,
  startChoosing = false,
  onChoose,
  labels = cookieBannerContent,
}: CookieBannerProps) {
  // Hooks
  const id = useId()
  const [choosing, setChoosing] = useState(startChoosing)
  const [draft, setDraft] = useState<Choice>(initial)
  const region = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!onChoose) return
    // The caret follows the banner in, so a screen reader hears that a question appeared.
    const wait = startChoosing ? 0 : delay * SECOND_MS
    const timer = window.setTimeout(() => region.current?.focus({ preventScroll: true }), wait)
    return () => window.clearTimeout(timer)
  }, [onChoose, startChoosing, delay])

  // Event handlers
  const handleChoose = (choice: Choice) => onChoose?.(choice)
  const handleToggle = (key: (typeof OPTIONAL)[number], checked: boolean) =>
    setDraft((d) => ({ ...d, [key]: checked }))

  // Render logic
  const copy = cookieBannerContent
  const policyHref = safeHref(policyLink)
  const panelId = `${id}-panel`
  const live = Boolean(onChoose)
  const style = { '--cookie-delay': `${startChoosing || !live ? 0 : delay}s` } as CSSProperties

  return (
    <div
      className={`cookie-banner cookie-banner--${position}${live ? '' : ' cookie-banner--static'}`}
      style={style}
    >
      <section
        ref={region}
        className="cookie-banner__card"
        aria-label={copy.regionLabel}
        tabIndex={-1}
      >
        <div className="cookie-banner__copy">
          {storeMessage ? (
            <p className="cookie-banner__message">{storeMessage}</p>
          ) : (
            <RichCopy value={message} className="cookie-banner__message" />
          )}
          {policyHref && policyLabel ? (
            <a className="cookie-banner__policy" href={policyHref}>
              {policyLabel}
            </a>
          ) : null}
        </div>
        {showPreferences && choosing ? (
          <div className="cookie-banner__panel" id={panelId}>
            <div className="cookie-banner__choice">
              <input type="checkbox" checked disabled aria-labelledby={`${id}-necessary`} />
              <span>
                <span id={`${id}-necessary`} className="cookie-banner__choice-name">
                  {labels.categories.necessary.label}
                </span>
                <span className="cookie-banner__choice-help">
                  {labels.categories.necessary.body}
                </span>
              </span>
            </div>
            {OPTIONAL.map((key) => (
              <label key={key} className="cookie-banner__choice">
                <input
                  type="checkbox"
                  checked={draft[key]}
                  onChange={(e) => handleToggle(key, e.target.checked)}
                />
                <span>
                  <span className="cookie-banner__choice-name">{labels.categories[key].label}</span>
                  <span className="cookie-banner__choice-help">{labels.categories[key].body}</span>
                </span>
              </label>
            ))}
            <button
              type="button"
              className="btn btn--primary cookie-banner__save"
              onClick={() => handleChoose(draft)}
            >
              <span>{labels.save}</span>
            </button>
          </div>
        ) : null}
        <div className="cookie-banner__actions">
          {showPreferences ? (
            <button
              type="button"
              className="cookie-banner__link"
              aria-expanded={choosing}
              aria-controls={choosing ? panelId : undefined}
              onClick={() => setChoosing((c) => !c)}
            >
              {orDefault(preferencesLabel, copy.preferencesLabel)}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--secondary cookie-banner__button"
            onClick={() => handleChoose(NONE)}
          >
            <span>{orDefault(declineLabel, copy.declineLabel)}</span>
          </button>
          <button
            type="button"
            className="btn btn--primary cookie-banner__button"
            onClick={() => handleChoose(ALL)}
          >
            <span>{orDefault(acceptLabel, copy.acceptLabel)}</span>
          </button>
        </div>
      </section>
    </div>
  )
}
