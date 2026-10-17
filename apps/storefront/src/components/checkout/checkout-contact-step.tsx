'use client'

import CheckoutContact from '@/components/checkout/checkout-contact'
import type { CheckoutFormModel } from '@/lib/use-checkout-form'

type CheckoutContactStepProps = { ck: CheckoutFormModel }

/**
 * Figma Checkout / Contact (488:3190): sign in or create the account with a code to the phone
 * or email (the store's own sign-in: SMS or WhatsApp, email, Google, Apple, Truecaller,
 * passkeys). Settings → Customer accounts decides whether a guest may skip it.
 */
export default function CheckoutContactStep({ ck }: CheckoutContactStepProps) {
  return <CheckoutContact ck={ck} />
}
