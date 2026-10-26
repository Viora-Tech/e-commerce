'use client'

import ErrorScreen from '@/components/errors/error-screen'

type CheckoutErrorProps = { error: unknown; retry: () => void }

/**
 * A checkout, payment or thank-you page that failed: the error card in the checkout's own
 * palette (the store's --ck-* branding), with the way back to the cart.
 */
export default function CheckoutError({ error, retry }: CheckoutErrorProps) {
  return <ErrorScreen kind="checkout" error={error} retry={retry} />
}
