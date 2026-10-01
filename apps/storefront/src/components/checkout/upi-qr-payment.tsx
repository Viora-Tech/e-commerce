'use client'

import type { UpiQr } from '@commerce/payments'
import { useRouter } from 'next/navigation'
import { toDataURL } from 'qrcode'
import { useEffect, useState, useTransition } from 'react'
import { upiQrContent as content, UPI_QR_SIZE } from '@/data/checkout'
import { checkQrPaymentAction, retryPaymentAction } from '@/lib/cart-actions'

type UpiQrPaymentProps = {
  orderNumber: number
  qr: UpiQr
  amountLabel: string
}

/** How often the page re-reads the order, to show the paid state once the webhook lands. */
const POLL_MS = 5_000

/** How often the page asks the gateway itself, for when the webhook is late or not set up. */
const GATEWAY_CHECK_MS = 15_000

const msLeft = (expiresAt: string, now: number): number =>
  Math.max(0, new Date(expiresAt).getTime() - now)

/** 29:05 */
function clock(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * The single-use UPI QR for this order: the exact amount, a countdown to when
 * it closes, and UPI app buttons on phones. The QR is the gateway's image, or
 * drawn here from the `upi://pay` link when the gateway only sends the link
 * (Decentro). Refreshes while open so the paid state shows as soon as the
 * webhook lands, and asks the gateway directly every so often (and on "I've
 * paid") in case it doesn't. Once closed, the shopper asks for a new QR.
 */
export default function UpiQrPayment({ orderNumber, qr, amountLabel }: UpiQrPaymentProps) {
  // Hooks
  const router = useRouter()
  const [now, setNow] = useState(() => Date.now())
  const [drawn, setDrawn] = useState<string | null>(null)
  const [notYet, setNotYet] = useState(false)
  const [checking, startCheck] = useTransition()

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    if (qr.imageUrl || !qr.upiUri) return
    let live = true
    toDataURL(qr.upiUri, { margin: 1, width: UPI_QR_SIZE }).then((src) => {
      if (live) setDrawn(src)
    })
    return () => {
      live = false
    }
  }, [qr.imageUrl, qr.upiUri])

  useEffect(() => {
    const poll = setInterval(() => {
      if (msLeft(qr.expiresAt, Date.now()) > 0) router.refresh()
    }, POLL_MS)
    const ask = setInterval(() => {
      if (msLeft(qr.expiresAt, Date.now()) === 0) return
      checkQrPaymentAction(orderNumber).then((paid) => {
        if (paid) router.refresh()
      })
    }, GATEWAY_CHECK_MS)
    return () => {
      clearInterval(poll)
      clearInterval(ask)
    }
  }, [qr.expiresAt, router, orderNumber])

  // Event handlers
  const handlePaid = () =>
    startCheck(async () => {
      const paid = await checkQrPaymentAction(orderNumber)
      setNotYet(!paid)
      if (paid) router.refresh()
    })

  // Render logic
  const left = msLeft(qr.expiresAt, now)
  const expired = left === 0
  const src = qr.imageUrl ?? drawn
  const apps = qr.apps ?? []

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
            {qr.upiUri && apps.length > 0 ? (
              <div className="manual-pay__open flex flex-col gap-2">
                <p className="text-small">{content.payWith}</p>
                <div className="flex flex-wrap gap-2">
                  {apps.map((a) => (
                    <a key={a.id} href={a.uri} className="btn btn--primary btn--small">
                      {content.apps[a.id]}
                    </a>
                  ))}
                  <a href={qr.upiUri} className="btn btn--secondary btn--small">
                    {content.otherApp}
                  </a>
                </div>
              </div>
            ) : qr.upiUri ? (
              <a href={qr.upiUri} className="btn btn--primary btn--small manual-pay__open">
                {content.open}
              </a>
            ) : null}
            {src ? (
              // biome-ignore lint/performance/noImgElement: gateway image or inline data URI, nothing to optimise.
              <img
                className="manual-pay__qr"
                src={src}
                alt={content.qrAlt(amountLabel)}
                width={UPI_QR_SIZE}
                height={UPI_QR_SIZE}
              />
            ) : (
              <div aria-hidden="true" className="manual-pay__qr size-[13.75rem]" />
            )}
            <p className="text-small" suppressHydrationWarning>
              {content.closesIn(clock(left))}
            </p>
            <p className="text-small">{content.help}</p>
            <button
              type="button"
              className="btn btn--secondary btn--small w-fit"
              onClick={handlePaid}
              disabled={checking}
            >
              {checking ? content.checking : content.paid}
            </button>
            {notYet && !checking ? <p className="text-small">{content.notYet}</p> : null}
          </>
        )}
      </div>
    </div>
  )
}
