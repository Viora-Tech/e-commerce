'use client'

import { formatPaise } from '@commerce/blocks'
import type { CheckoutSession } from '@commerce/payments'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { confirmPaymentAction } from '@/lib/cart-actions'

type RazorpayCheckout = new (options: Record<string, unknown>) => { open(): void }
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

const COPY: Record<State, string> = {
  loading: 'Opening secure payment.',
  ready: 'Complete the payment in the window.',
  confirming: 'Confirming your payment.',
  failed: 'The payment could not be verified. You can try again.',
  dismissed: 'Payment window closed. Your order is saved; pay when ready.',
}

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
    if (!src) return
    const s = document.createElement('script')
    s.src = src
    s.onload = () => {
      if (!opened.current) {
        opened.current = true
        handleOpen()
      }
    }
    document.body.appendChild(s)
    return () => {
      s.remove()
    }
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
      modal: { ondismiss: () => setState('dismissed') },
    })
    checkout.open()
  }

  return (
    <section className="section-cart page-width">
      <div className="cart-empty">
        <h1 className="cart-empty__heading h2">Order #{orderNumber}</h1>
        <p className="cart-empty__text text-body">
          {COPY[state]} {state === 'ready' ? `Amount: ${formatPaise(amountPaise)}.` : ''}
        </p>
        {state === 'failed' || state === 'dismissed' ? (
          <button type="button" className="btn btn--primary" onClick={handleOpen}>
            Try again
          </button>
        ) : null}
      </div>
    </section>
  )
}
