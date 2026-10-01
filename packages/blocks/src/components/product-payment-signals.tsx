'use client'

import { type ReactNode, useRef } from 'react'
import { mainProductContent as copy } from '../data/glide/main-product'
import { formatPaise } from '../money'
import { safeHref } from '../slot-types'
import Icon from './icon'
import RichCopy from './rich-copy'

type ProductPaymentSignalsProps = {
  /** The merchant's note ("Extra 3% off on UPI"); a node while edited on the canvas. */
  note: ReactNode
  /** Selected variant's price; with `upiPercent` the note becomes "₹X with UPI". */
  pricePaise: number
  upiPercent: number
  heading: string
  /** Steps shown in the panel (richtext HTML). */
  body: string
  supportLabel: string
  supportUrl: string
}

const ui = copy.ui

/** The UPI price, rounded down to the whole rupee as the checkout charges it. */
const upiPaise = (pricePaise: number, percent: number) =>
  Math.floor((pricePaise * (100 - percent)) / 100 / 100) * 100

// The `payment_signals` block with snippets/offer-modal.liquid: the offer note under the
// price, which opens a panel explaining how to claim it when there is anything to explain.
// The theme's payment-type icons (Shopify's enabled_payment_types) have no equivalent here.
export default function ProductPaymentSignals({
  note,
  pricePaise,
  upiPercent,
  heading,
  body,
  supportLabel,
  supportUrl,
}: ProductPaymentSignalsProps) {
  // Hooks
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Event handlers
  const handleOpen = () => dialogRef.current?.showModal()
  const handleClose = () => dialogRef.current?.close()

  // Render logic
  const inline = upiPercent > 0 && pricePaise > 0
  const support = supportLabel ? safeHref(supportUrl) : null
  const hasPanel = Boolean(body.trim() || support)
  const shown = inline ? (
    <>
      <span className="offer-note__price">{formatPaise(upiPaise(pricePaise, upiPercent))}</span>{' '}
      {ui.upiPrice}
    </>
  ) : (
    note
  )

  return (
    <div className="payment-signals">
      <div className={`offer-note${inline ? ' offer-note--inline' : ''}`}>
        {hasPanel ? (
          <>
            <button
              type="button"
              className="offer-note__button"
              aria-haspopup="dialog"
              onClick={handleOpen}
            >
              <span className="offer-note__icon">
                <Icon name="payment" size={18} />
              </span>
              <span className="offer-note__text">{shown}</span>
              <span className="offer-note__more">{ui.offerHow}</span>
            </button>
            <dialog ref={dialogRef} className="offer-modal" aria-label={heading || ui.offerHow}>
              <div className="offer-modal__panel">
                <div className="offer-modal__head">
                  <h2 className="offer-modal__heading">{heading || note}</h2>
                  <button
                    type="button"
                    className="offer-modal__close"
                    aria-label={ui.close}
                    onClick={handleClose}
                  >
                    <Icon name="close" size={20} />
                  </button>
                </div>
                <div className="offer-modal__body">
                  <RichCopy value={body} className="offer-modal__steps rte" />
                  {support ? (
                    <a
                      className="offer-modal__support"
                      href={support}
                      target="_blank"
                      rel="noopener"
                    >
                      {supportLabel}
                      <Icon name="arrow" size={14} />
                    </a>
                  ) : null}
                </div>
              </div>
            </dialog>
          </>
        ) : (
          <p className="offer-note__static">
            <span className="offer-note__icon">
              <Icon name="payment" size={18} />
            </span>
            <span className="offer-note__text">{shown}</span>
          </p>
        )}
      </div>
    </div>
  )
}
