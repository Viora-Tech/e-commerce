'use client'

import type { UpiQr } from '@commerce/payments'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { upiQrContent as content, UPI_QR_SIZE } from '@/data/checkout'
import { retryPaymentAction } from '@/lib/cart-actions'

type UpiQrPaymentProps = {
  orderNumber: number
  qr: UpiQr
  amountLabel: string
}

/** How often the page asks the server whether the webhook has marked the order paid. */
const POLL_MS = 5_000

const msLeft = (expiresAt: string, now: number): number =>
  Math.max(0, new Date(expiresAt).getTime() - now)

/** 29:05 */
function clock(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * The single-use UPI QR for this order: the exact amount, a countdown to when
 * it closes, and a UPI app link on phones. Refreshes the page while open so
 * the paid state shows as soon as Razorpay's webhook lands; once closed, the
 * shopper asks for a new QR (a new payment attempt).
 */
export default function UpiQrPayment({ orderNumber, qr, amountLabel }: UpiQrPaymentProps) {
  // Hooks
  const router = useRouter()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    const poll = setInterval(() => {
      if (msLeft(qr.expiresAt, Date.now()) > 0) router.refresh()
    }, POLL_MS)
    return () => clearInterval(poll)
  }, [qr.expiresAt, router])

  // Render logic
  const left = msLeft(qr.expiresAt, now)
  const expired = left === 0

  return (
    <div className="manual-pay">
      <div className="manual-pay__card">
        <h3 className="h4">{content.heading(amountLabel)}</h3>
        {expired ? (
          <>
            <p className="text-body">{content.expired}</p>
            <form action={retryPaymentAction.bind(null, orderNumber)}>
              <button type="submit" className="btn btn--primary">
                {content.renew}
              </button>
            </form>
          </>
        ) : (
          <>
            {/* biome-ignore lint/performance/noImgElement: gateway-hosted QR image, nothing to optimise. */}
            <img
              className="manual-pay__qr"
              src={qr.imageUrl}
              alt={content.qrAlt(amountLabel)}
              width={UPI_QR_SIZE}
              height={UPI_QR_SIZE}
            />
            <p className="text-small" suppressHydrationWarning>
              {content.closesIn(clock(left))}
            </p>
            <p className="text-small">{content.help}</p>
            {qr.upiUri ? (
              <a href={qr.upiUri} className="btn btn--primary btn--small manual-pay__open">
                {content.open}
              </a>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
