'use client'

import type { UpiQr } from '@commerce/payments'
import { useRouter } from 'next/navigation'
import { toDataURL } from 'qrcode'
import { useEffect, useState, useTransition } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { upiQrContent as content, UPI_QR_SIZE } from '@/data/checkout'
import { checkQrPaymentAction, retryPaymentAction } from '@/lib/cart-actions'
import { CK_BUTTON_PRIMARY, CK_BUTTON_SECONDARY, CK_HEADING } from '@/lib/checkout-classes'

type UpiQrPaymentProps = {
  orderNumber: number
  /** The order's view token: the checks and "New QR" prove access with it, never the number alone. */
  viewToken: string
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
export default function UpiQrPayment({
  orderNumber,
  viewToken,
  qr,
  amountLabel,
}: UpiQrPaymentProps) {
  // Hooks
  const router = useRouter()
  // The clock is read only after hydration: the server's time and the shopper's differ, and
  // a QR that closes in between would draw the expired state on one side only (error #418).
  const [now, setNow] = useState<number | null>(null)
  const [drawn, setDrawn] = useState<string | null>(null)
  const [notYet, setNotYet] = useState(false)
  const [checking, startCheck] = useTransition()

  useEffect(() => {
    setNow(Date.now())
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
      checkQrPaymentAction(orderNumber, viewToken).then((paid) => {
        if (paid) router.refresh()
      })
    }, GATEWAY_CHECK_MS)
    return () => {
      clearInterval(poll)
      clearInterval(ask)
    }
  }, [qr.expiresAt, router, orderNumber, viewToken])

  // Event handlers
  const handlePaid = () =>
    startCheck(async () => {
      const paid = await checkQrPaymentAction(orderNumber, viewToken)
      setNotYet(!paid)
      if (paid) router.refresh()
    })

  // Render logic
  // Null until the page has the shopper's clock: open, with no countdown yet.
  const left = now === null ? null : msLeft(qr.expiresAt, now)
  const expired = left === 0
  const src = qr.imageUrl ?? drawn
  const apps = qr.apps ?? []
  // With a upi:// link a phone opens the app instead; the QR is for paying from another device.
  const qrClass = qr.upiUri ? 'hidden lg:flex' : 'flex'

  return (
    <div className="flex flex-col gap-5 rounded-ck border border-ck-line bg-ck-field p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className={`${CK_HEADING} text-[1.0625rem]!`}>{content.heading(amountLabel)}</h2>
          <p className="text-[0.8125rem] text-ck-muted">{content.help}</p>
        </div>
        {left === null || expired ? null : (
          <span
            className="shrink-0 rounded-full bg-ck-soft px-2.5 py-1 text-[0.75rem] font-medium tabular-nums text-ck-muted"
            title={content.closesIn(clock(left))}
          >
            <span className="sr-only">{content.closesIn(clock(left))}</span>
            <span aria-hidden="true">{clock(left)}</span>
          </span>
        )}
      </div>
      {expired ? (
        <div className="flex flex-col gap-4">
          <p className="text-[0.9375rem] text-ck-ink">{content.expired}</p>
          <form action={retryPaymentAction.bind(null, orderNumber, viewToken)}>
            <button type="submit" className={CK_BUTTON_PRIMARY}>
              {content.renew}
            </button>
          </form>
        </div>
      ) : (
        <>
          {qr.upiUri ? (
            <div className="flex flex-col gap-2.5 lg:hidden">
              <p className="text-[0.8125rem] font-medium text-ck-muted">{content.payWith}</p>
              <div className="grid grid-cols-2 gap-2.5">
                {apps.map((a) => (
                  <a key={a.id} href={a.uri} className={`${CK_BUTTON_SECONDARY} h-12! w-full`}>
                    {content.apps[a.id]}
                  </a>
                ))}
                <a
                  href={qr.upiUri}
                  className={`${apps.length > 0 ? CK_BUTTON_SECONDARY : CK_BUTTON_PRIMARY} ${apps.length % 2 === 0 ? 'col-span-2' : ''} h-12! w-full no-underline`}
                >
                  {apps.length > 0 ? content.otherApp : content.open}
                </a>
              </div>
            </div>
          ) : null}
          <div className={`${qrClass} flex-col items-center gap-3 rounded-ck bg-ck-soft p-5`}>
            {src ? (
              // biome-ignore lint/performance/noImgElement: gateway image or inline data URI, nothing to optimise.
              <img
                className="size-[13.75rem]! rounded-ck bg-ck-qr p-2.5 [box-shadow:0_1px_3px_rgb(0_0_0/0.08)]"
                src={src}
                alt={content.qrAlt(amountLabel)}
                width={UPI_QR_SIZE}
                height={UPI_QR_SIZE}
              />
            ) : (
              <div
                aria-hidden="true"
                className="size-[13.75rem] animate-pulse rounded-ck bg-ck-line motion-reduce:animate-none"
              />
            )}
          </div>
          <div className="flex flex-col gap-2.5">
            <p role="status" className="flex items-center gap-2 text-[0.8125rem] text-ck-muted">
              <CheckoutIcon
                name="spinner"
                className="size-3.5 animate-spin motion-reduce:animate-none"
              />
              {notYet && !checking ? content.notYet : content.waiting}
            </p>
            <button
              type="button"
              className={`${CK_BUTTON_SECONDARY} w-full`}
              onClick={handlePaid}
              disabled={checking}
            >
              {checking ? content.checking : content.paid}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
