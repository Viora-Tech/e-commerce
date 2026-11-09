import { type Dispatch, type SetStateAction, useState } from 'react'
import type { CheckoutFormState } from '@/lib/checkout-form-state'
import { offCod } from '@/lib/checkout-opening'
import { storeCreditOffered } from '@/lib/checkout-preview'
import type { AppliedGiftCard } from '@/lib/gift-card-actions'
import type { CheckoutMethod } from '@/lib/payments'

/**
 * What pays beside the chosen way to pay: the gift cards applied in the summary and the
 * signed-in shopper's store credit. Store credit is their own money, so it is on by default with
 * a switch to keep it for later; a guest never has any. Previews only: `placeOrder` spends both
 * again on the server.
 */
export function useCheckoutTender(
  methods: CheckoutMethod[],
  setForm: Dispatch<SetStateAction<CheckoutFormState>>,
  signedIn: boolean,
  /** The signed-in shopper's balance, as the page loaded it. */
  storeCreditPaise: number | undefined,
) {
  const [giftCards, setGiftCards] = useState<AppliedGiftCard[]>([])
  const [creditOn, setCreditOn] = useState(true)
  const balancePaise = storeCreditOffered(signedIn, storeCreditPaise ?? 0)

  /* COD cannot collect what a gift card leaves; move to the first online method. */
  const handleGiftCardApply = (card: AppliedGiftCard) => {
    setGiftCards((prev) => [...prev, card])
    setForm((prev) => offCod(prev, methods))
  }
  const handleGiftCardRemove = (code: string) =>
    setGiftCards((prev) => prev.filter((c) => c.code !== code))
  /* Cash on delivery cannot collect what store credit leaves: `checkoutTotals` moves off it. */
  const handleStoreCredit = (on: boolean) => setCreditOn(on)

  return {
    giftCards,
    storeCredit: { balancePaise, on: creditOn },
    /** The balance `checkoutTotals` may spend: 0 while the switch is off. */
    spendablePaise: creditOn ? balancePaise : 0,
    handleGiftCardApply,
    handleGiftCardRemove,
    handleStoreCredit,
  }
}
