'use client'

// Port of sections/signup-popup.liquid (+ assets/signup-popup.js): three looks off one card.
//   corner  slides up bottom-right, no overlay, the page stays usable
//   figure  centred card, a product rises out of it; dims the page
//   feed    neon-edged card listing drops, then the signup
// In the Customize canvas it is drawn in place and open, so it can be edited.
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { signupPopupContent as copy } from '../../../data/glide/signup-popup'
import type { Image } from '../../../sections/framed'
import type { PopupStyle } from '../../../sections/glide/signup-popup'
import type { CardProduct } from '../../../types'
import Icon from '../../icon'
import Picture from '../../picture'
import type { NewsletterAction } from '../newsletter'
import SignupPopupBody from './signup-popup-body'
import {
  armPopup,
  consentPending,
  countPage,
  markShown,
  markSubscribed,
  type PopupTrigger,
  type PopupWhere,
  pageAllowed,
  popupKey,
  suppressed,
} from './signup-popup-timing'

type SignupPopupProps = {
  sectionId: string
  style: PopupStyle
  image: Image
  where: PopupWhere
  collections: string
  trigger: PopupTrigger
  delay: number
  delayMobile: number
  scroll: number
  repeatDays: number
  kicker: ReactNode
  heading: ReactNode
  text: ReactNode
  buttonLabel: ReactNode
  finePrint: ReactNode
  successHeading: ReactNode
  successText: ReactNode
  discountCode: string
  figure: CardProduct | null
  feed: CardProduct[]
  editing: boolean
  action?: NewsletterAction | undefined
}

type Phase = 'hidden' | 'shown' | 'open' | 'closing'

/** Lets the hidden → shown frame paint before the opening transition starts. */
const PAINT_MS = 30
/** The longest closing transition in section-signup-popup.css. */
const CLOSE_MS = 450
/** Re-check while the consent banner is waiting for an answer. */
const CONSENT_RETRY_MS = 4000
const LOCK_CLASS = 'signup-popup-lock'

export default function SignupPopup({
  sectionId,
  style,
  image,
  where,
  collections,
  trigger,
  delay,
  delayMobile,
  scroll,
  repeatDays,
  figure,
  feed,
  editing,
  action,
  ...text
}: SignupPopupProps) {
  // Hooks
  const id = useId()
  const [phase, setPhase] = useState<Phase>('hidden')
  const card = useRef<HTMLDivElement>(null)
  const lastFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (editing) return
    countPage()
    const key = popupKey(sectionId)
    if (!pageAllowed(where, collections, window.location.pathname)) return
    if (suppressed(key, repeatDays)) return
    let retry: number | undefined
    let stop = () => {}
    const open = () => {
      if (document.hidden || suppressed(key, repeatDays)) return
      if (consentPending()) {
        window.clearTimeout(retry)
        retry = window.setTimeout(open, CONSENT_RETRY_MS)
        return
      }
      stop()
      markShown(key)
      lastFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      setPhase('shown')
    }
    stop = armPopup({ trigger, delay, delayMobile, scroll }, open)
    return () => {
      stop()
      window.clearTimeout(retry)
    }
  }, [editing, sectionId, where, collections, repeatDays, trigger, delay, delayMobile, scroll])

  useEffect(() => {
    if (phase !== 'shown' && phase !== 'closing') return
    const next = phase === 'shown' ? 'open' : 'hidden'
    const timer = window.setTimeout(() => setPhase(next), phase === 'shown' ? PAINT_MS : CLOSE_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'open') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPhase('closing')
    }
    document.addEventListener('keydown', onKey)
    if (style !== 'figure') return () => document.removeEventListener('keydown', onKey)
    // The figure look is a modal: the page stops scrolling and the field takes the caret.
    const root = document.documentElement
    root.classList.add(LOCK_CLASS)
    const focus = window.setTimeout(() => {
      const input = card.current?.querySelector<HTMLInputElement>('input[type="email"]')
      ;(input ?? card.current)?.focus({ preventScroll: true })
    }, CLOSE_MS)
    return () => {
      document.removeEventListener('keydown', onKey)
      root.classList.remove(LOCK_CLASS)
      window.clearTimeout(focus)
      lastFocus.current?.focus({ preventScroll: true })
    }
  }, [phase, style])

  // Event handlers
  const handleClose = () => {
    if (!editing) setPhase('closing')
  }
  const handleDone = () => {
    if (!editing) markSubscribed()
  }

  // Render logic
  const headingId = `${id}-heading`
  const isOpen = editing || phase === 'open'
  const figureImage = figure?.images[0]
  const classes = [
    'signup-popup',
    `signup-popup--${style}`,
    isOpen ? 'is-open' : '',
    editing ? 'signup-popup--editing' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} hidden={!editing && phase === 'hidden'}>
      {editing ? (
        <p className="signup-popup__editor-note">{copy.editorNote(copy.triggerNotes[trigger])}</p>
      ) : null}
      {style === 'figure' && !editing ? (
        <div className="signup-popup__scrim" onClick={handleClose} aria-hidden="true" />
      ) : null}
      <div
        ref={card}
        className="signup-popup__card"
        role="dialog"
        aria-modal={style === 'figure' && !editing ? true : undefined}
        aria-labelledby={headingId}
        tabIndex={-1}
      >
        <button
          type="button"
          className="signup-popup__close"
          aria-label={copy.close}
          onClick={handleClose}
        >
          <Icon name="close" size={16} />
        </button>
        {style === 'corner' && image?.url ? (
          <div className="signup-popup__media">
            <Picture image={image} alt="" fill sizes="22.5rem" loading="lazy" />
          </div>
        ) : null}
        {style === 'figure' ? <div className="signup-popup__ring" aria-hidden="true" /> : null}
        {style === 'figure' && figureImage ? (
          <div className="signup-popup__figure" aria-hidden="true">
            <Picture
              image={figureImage}
              alt=""
              sizes="16.25rem"
              loading="lazy"
              placeholder={false}
            />
          </div>
        ) : null}
        <SignupPopupBody
          style={style}
          headingId={headingId}
          kicker={text.kicker}
          heading={text.heading}
          text={text.text}
          buttonLabel={text.buttonLabel}
          finePrint={text.finePrint}
          successHeading={text.successHeading}
          successText={text.successText}
          discountCode={text.discountCode}
          feed={feed}
          action={action}
          onDone={handleDone}
        />
      </div>
    </div>
  )
}
