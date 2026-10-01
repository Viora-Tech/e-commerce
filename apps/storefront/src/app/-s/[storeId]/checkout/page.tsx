import { getCart, listAddresses, publishedPolicyLinks, storeCheckoutSettings } from '@commerce/core'
import { redirect } from 'next/navigation'
import CheckoutForm from '@/components/checkout/checkout-form'
import { readCartId } from '@/lib/cart-cookie'
import { currentCustomer } from '@/lib/customer-session'
import { cartDiscountView } from '@/lib/discount-actions'
import { storeCheckoutMethods } from '@/lib/payments'
import { nonRefundableDepositDays } from '@/lib/preorder'
import { storeSignIn } from '@/lib/sign-in-methods'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string }> }

export default async function CheckoutPage({ params }: Params) {
  const { storeId } = await params
  const cartId = await readCartId()
  const cart = cartId ? await inStore(storeId, (tx) => getCart({ storeId, tx }, cartId)) : null
  if (cart?.status !== 'open' || cart.lines.length === 0) redirect('/cart')
  // Settings → Customer accounts can require an account before checkout.
  const [signIn, signedIn] = await Promise.all([storeSignIn(storeId), currentCustomer(storeId)])
  if (signIn.checkout === 'account_required' && !signedIn) {
    redirect('/account/login?return_to=%2Fcheckout')
  }
  const [methods, discount, me, depositDays, settings, policies] = await Promise.all([
    inStore(storeId, (tx) => storeCheckoutMethods(tx, storeId)),
    cartDiscountView(cart.id, cart.discountCode),
    currentCustomer(storeId),
    inStore(storeId, (tx) => nonRefundableDepositDays(tx, storeId, cart.id)),
    inStore(storeId, (tx) => storeCheckoutSettings({ tx, storeId })),
    inStore(storeId, (tx) => publishedPolicyLinks({ tx, storeId })),
  ])
  // A signed-in shopper checks out as themselves, with their address book to pick from.
  const addresses = me ? await inStore(storeId, (tx) => listAddresses({ storeId, tx }, me.id)) : []
  return (
    <CheckoutForm
      cart={cart}
      methods={methods}
      discount={discount}
      customer={me}
      addresses={addresses}
      nonRefundableDepositDays={depositDays}
      settings={settings}
      policies={policies}
    />
  )
}
