'use client'

import { formatPaise } from '@commerce/blocks'
import type { CheckoutSession } from '@commerce/payments'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { confirmPaymentAction } from '@/lib/cart-actions'

type RazorpayCheckout = new (options: Record<string, unknown>) => { open(): void }
declare global {
  interface Window {
    Razorpay?: RazorpayCheckout
  }
}

const SCRIPTS: Record<string, string> = {
  razorpay: 'https://checkout.razorpay.com/v1/checkout.js',
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
  storeId,
  orderNumber,
  session,
  amountPaise,
}: {
  storeId: string
  orderNumber: number
  session: Extract<CheckoutSession, { kind: 'client' }>
  amountPaise: number
}) {
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

  // Event handlers
  const handleOpen = () => {
    const Rzp = window.Razorpay
    if (!Rzp) return
    setState('ready')
    const checkout = new Rzp({
      ...session.options,
      handler: async (response: Record<string, string>) => {
        setState('confirming')
        const status = await confirmPaymentAction(storeId, session.providerRef, response)
        if (status === 'captured' || status === 'pending') {
          router.push(`/checkout/thank-you/${orderNumber}`)
        } else {
          setState('failed')
        }
      },
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
