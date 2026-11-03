'use client'

import { type ReactNode, useRef } from 'react'
import { mainProductContent as copy } from '../data/zero-drift/main-product'
import { useFormatPaise } from '../money-format'
import { safeHref } from '../slot-types'
import Icon from './icon'
import RichCopy from './rich-copy'

type ProductPaymentSignalsProps = {
  /** The merchant's note ("Extra 3% off on UPI"); a node while edited on the canvas. */
  note: ReactNode
  /** Selected variant's price; with `upiPercent` the note becomes "₹X with UPI". */
  pricePaise: number
  upiPercent: number
  /** The `showUpiPrice` setting: false keeps the note as written, without a "₹X with UPI" price. */
  upiPrice: boolean
  heading: string
  /** Steps shown in the panel (richtext HTML). */
  body: string
  supportLabel: string
  supportUrl: string
  /** The store's UPI checkout discount; null hides a UPI price note, undefined previews `upiPercent`. */
  upiDiscount?: UpiDiscount | null | undefined
}

/**
 * A payment-method adjustment as the store saves it (`store.payments.adjustments`): paise for
 * `fixed`, basis points for `percent`, negative for a discount.
 */
export type UpiDiscount = { type: 'fixed' | 'percent'; value: number }

const ui = copy.ui

/** The section's own percentage (an editor preview), rounded down to the rupee as the theme did. */
const previewPaise = (pricePaise: number, percent: number) =>
  Math.floor((pricePaise * (100 - percent)) / 100 / 100) * 100

/** Half away from zero, never −0. */
const roundHalfUp = (n: number): number => Math.sign(n) * Math.round(Math.abs(n)) || 0

/**
 * The price after the store's UPI discount, exactly as checkout charges it
 * (`@commerce/core/adjustment-math` `paymentAdjustmentPaise`, which this mirrors: blocks does
 * not depend on core). A percent discount comes off in whole rupees, half away from zero, so
 * a ₹2,699 item at −2% reads (and charges) ₹2,645, never ₹2,645.02.
 */
export function upiPricePaise(pricePaise: number, d: UpiDiscount): number {
  const off =
    d.type === 'fixed'
      ? d.value
      : d.value < 0
        ? roundHalfUp((pricePaise * d.value) / 10_000 / 100) * 100
        : roundHalfUp((pricePaise * d.value) / 10_000)
  return Math.max(0, pricePaise + off)
}

// The `payment_signals` block with snippets/offer-modal.liquid: the offer note under the
// price, which opens a panel explaining how to claim it when there is anything to explain.
// The theme's payment-type icons (Shopify's enabled_payment_types) have no equivalent here.
export default function ProductPaymentSignals({
  note,
  pricePaise,
  upiPercent,
  upiPrice,
  heading,
  body,
  supportLabel,
  supportUrl,
  upiDiscount,
}: ProductPaymentSignalsProps) {
  // Hooks
  const formatPaise = useFormatPaise()
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Event handlers
  const handleOpen = () => dialogRef.current?.showModal()
  const handleClose = () => dialogRef.current?.close()

  // Early returns
  // A "₹X with UPI" note the checkout would not honour is worse than none.
  const storeDiscount = upiDiscount && upiDiscount.value < 0 ? upiDiscount : null
  if (upiDiscount !== undefined && !storeDiscount && upiPercent > 0) return null

  // Render logic
  const upiPaise = !upiPrice
    ? null
    : storeDiscount
      ? upiPricePaise(pricePaise, storeDiscount)
      : upiDiscount === undefined && upiPercent > 0
        ? previewPaise(pricePaise, upiPercent)
        : null
  // A discount too small to reach a rupee leaves the price as it is: the note says it instead.
  const inline = upiPaise !== null && pricePaise > 0 && upiPaise < pricePaise
  const support = supportLabel ? safeHref(supportUrl) : null
  const hasPanel = Boolean(body.trim() || support)
  const shown = inline ? (
    <>
      <span className="offer-note__price">{formatPaise(upiPaise ?? pricePaise)}</span> {ui.upiPrice}
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
