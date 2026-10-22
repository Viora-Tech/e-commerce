'use client'

import { formatPaise } from '@commerce/blocks'
import type { CheckoutSession } from '@commerce/payments'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import StatusMark from '@/components/checkout/status-mark'
import { payClientContent as content } from '@/data/checkout'
import { confirmPaymentAction } from '@/lib/cart-actions'
import { CK_BUTTON_PRIMARY, CK_HEADING } from '@/lib/checkout-classes'

type RazorpayCheckout = new (
  options: Record<string, unknown>,
) => { open(): void; on(event: 'payment.failed', handler: () => void): void }
type CashfreeResult = { error?: unknown; redirect?: boolean; paymentDetails?: unknown }
type CashfreeFactory = (init: { mode: string }) => {
  checkout(options: Record<string, unknown>): Promise<CashfreeResult>
}
declare global {
  interface Window {
    Razorpay?: RazorpayCheckout
    Cashfree?: CashfreeFactory
  }
}

type PayClientProps = {
  orderNumber: number
  session: Extract<CheckoutSession, { kind: 'client' }>
  amountPaise: number
  /** The signed `/checkout/thank-you/...` path; built server-side, token included. */
  thankYouPath: string
}

/** The gateways' own browser scripts (Razorpay Checkout, Cashfree JS SDK v3). */
const SCRIPTS: Record<string, string> = {
  razorpay: 'https://checkout.razorpay.com/v1/checkout.js',
  cashfree: 'https://sdk.cashfree.com/js/v3/cashfree.js',
}

type State = 'loading' | 'ready' | 'confirming' | 'failed' | 'dismissed'

/**
 * Opens the gateway's client checkout for a `client` session and posts the
 * confirmation back. The webhook remains the source of truth; this page just
 * gets the shopper to the thank-you page quickly when the gateway confirms.
 */
export default function PayClient({
  orderNumber,
  session,
  amountPaise,
  thankYouPath,
}: PayClientProps) {
  // Hooks
  const router = useRouter()
  const [state, setState] = useState<State>('loading')
  const opened = useRef(false)
  useEffect(() => {
    const src = SCRIPTS[session.provider]
    if (!src || opened.current) return
    // Added once: re-adding it on every render re-ran the gateway's script under its open window.
    if (document.querySelector(`script[src="${src}"]`)) {
      // Already loaded (back on this page without a reload): open straight away.
      if (window.Razorpay || window.Cashfree) {
        opened.current = true
        handleOpen()
      }
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => {
      if (!opened.current) {
        opened.current = true
        handleOpen()
      }
    }
    document.body.appendChild(s)
  })

  // Helpers
  const confirm = async (response: Record<string, string>) => {
    setState('confirming')
    const status = await confirmPaymentAction(session.providerRef, response)
    if (status === 'captured' || status === 'pending') {
      router.push(thankYouPath)
    } else {
      setState('failed')
    }
  }

  const openCashfree = async () => {
    const factory = window.Cashfree
    if (!factory) return
    setState('ready')
    const result = await factory({ mode: String(session.options.mode ?? 'sandbox') }).checkout({
      paymentSessionId: session.options.paymentSessionId,
      redirectTarget: '_modal',
    })
    // Cashfree reports the outcome through its API and webhook; ask the server either way.
    if (result.paymentDetails) await confirm({})
    else setState('dismissed')
  }

  /** Razorpay can leave its dimmed layer and a locked scroll behind after a failed or closed
   *  payment; clear them so the page (and its Try again button) is usable. */
  const clearOverlay = () => {
    for (const el of document.querySelectorAll('.razorpay-container')) el.remove()
    document.body.style.overflow = ''
  }

  // Event handlers
  const handleOpen = () => {
    if (session.provider === 'cashfree') {
      void openCashfree()
      return
    }
    const Rzp = window.Razorpay
    if (!Rzp) return
    setState('ready')
    const checkout = new Rzp({
      ...session.options,
      handler: confirm,
      modal: {
        ondismiss: () => {
          clearOverlay()
          setState((s) => (s === 'failed' ? s : 'dismissed'))
        },
      },
    })
    // A declined or blocked payment: Razorpay shows its own message; the page underneath says
    // it failed and offers Try again once the window closes.
    checkout.on('payment.failed', () => setState('failed'))
    checkout.open()
  }

  // Render logic
  const stopped = state === 'failed' || state === 'dismissed'
  const busy = state === 'loading' || state === 'confirming'

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <StatusMark tone={state === 'failed' ? 'failed' : 'pending'} />
        <div className="flex flex-col gap-2">
          <p className="text-[0.875rem] font-medium text-ck-muted">
            {content.heading(orderNumber)}
          </p>
          <h1 className={`${CK_HEADING} text-[2.25rem]! tabular-nums`}>
            {formatPaise(amountPaise)}
          </h1>
          <p role="status" className="flex items-center gap-2 text-[1rem] text-ck-muted">
            {busy ? (
              <CheckoutIcon
                name="spinner"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
            ) : null}
            {content.state[state]}
          </p>
        </div>
      </div>
      {stopped ? (
        <button type="button" className={CK_BUTTON_PRIMARY} onClick={handleOpen}>
          {content.tryAgain}
        </button>
      ) : null}
      <p className="flex items-center gap-2 text-[0.8125rem] text-ck-muted">
        <CheckoutIcon name="lock" className="size-3.5" />
        {content.secure}
      </p>
    </div>
  )
}
