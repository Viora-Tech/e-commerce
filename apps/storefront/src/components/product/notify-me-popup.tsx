'use client'

import { Icon, type NotifyMeWidget } from '@commerce/blocks'
import type { CSSProperties } from 'react'
import { useRef } from 'react'
import { backInStockContent as content } from '@/data/back-in-stock'
import NotifyMeFields from './notify-me-fields'

type NotifyMePopupProps = {
  variantId: string
  whatsappEnabled: boolean
  widget: NotifyMeWidget
  /** The pop-up's line with `{product}` already filled in. */
  description: string
}

const RADIUS: Record<NotifyMeWidget['buttonRadius'], string> = {
  none: '0rem',
  small: '0.25rem',
  medium: '0.5rem',
  large: '0.75rem',
  full: '999rem',
}

/**
 * The custom button's colours and rounding. Inline, because an imported theme's own `.btn`
 * rules outrank utility classes; the merchant's colours must win on every theme.
 */
function customStyle(w: NotifyMeWidget): CSSProperties | undefined {
  if (w.buttonStyle !== 'custom') return undefined
  return {
    backgroundColor: w.buttonBackground,
    borderColor: w.buttonBackground,
    color: w.buttonTextColor,
    borderRadius: RADIUS[w.buttonRadius],
  }
}

/**
 * Essential's back-in-stock look: a full-width "Notify me when available" button under the
 * sold-out state (styled like Add to cart, or in the campaign's own colours) that opens a
 * centred pop-up with the heading, the "{product}" line and the signup form.
 */
export default function NotifyMePopup({
  variantId,
  whatsappEnabled,
  widget,
  description,
}: NotifyMePopupProps) {
  // Hooks
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Event handlers
  const handleOpen = () => dialogRef.current?.showModal()
  const handleClose = () => dialogRef.current?.close()

  // Render logic
  const style = customStyle(widget)
  // Custom colours skip the theme's `.btn`: its hover fill would cover them.
  const buttonClass = style
    ? 'flex min-h-12 w-full cursor-pointer items-center justify-center border px-5 text-sm font-semibold tracking-wide uppercase transition-opacity hover:opacity-90'
    : 'btn btn--primary product-notify__submit w-full'

  return (
    <>
      <button
        type="button"
        className={buttonClass}
        style={style}
        aria-haspopup="dialog"
        onClick={handleOpen}
      >
        <span>{widget.buttonText}</span>
      </button>
      <dialog
        ref={dialogRef}
        className="offer-modal w-[min(26rem,calc(100vw-2rem))]"
        aria-label={widget.popupHeading}
      >
        <div className="offer-modal__panel">
          <div className="offer-modal__head">
            <h2 className="offer-modal__heading text-xl">{widget.popupHeading}</h2>
            <button
              type="button"
              className="offer-modal__close"
              aria-label={content.close}
              onClick={handleClose}
            >
              <Icon name="close" size={20} />
            </button>
          </div>
          <div className="offer-modal__body group gap-4">
            {description ? (
              <p className="m-0 text-base group-has-data-done:hidden">{description}</p>
            ) : null}
            <NotifyMeFields
              variantId={variantId}
              whatsappEnabled={whatsappEnabled}
              widget={widget}
              popup
            />
          </div>
        </div>
      </dialog>
    </>
  )
}
