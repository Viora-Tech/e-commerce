import { getCart } from '@commerce/core'
import { redirect } from 'next/navigation'
import CheckoutForm from '@/components/checkout/checkout-form'
import { readCartId } from '@/lib/cart-cookie'
import { cartDiscountView } from '@/lib/discount-actions'
import { storeCheckoutMethods } from '@/lib/payments'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string }> }

export default async function CheckoutPage({ params }: Params) {
  const { storeId } = await params
  const cartId = await readCartId()
  const cart = cartId ? await inStore(storeId, (tx) => getCart({ storeId, tx }, cartId)) : null
  if (cart?.status !== 'open' || cart.lines.length === 0) redirect('/cart')
  const [methods, discount] = await Promise.all([
    inStore(storeId, (tx) => storeCheckoutMethods(tx, storeId)),
    cartDiscountView(storeId, cart.id, cart.discountCode),
  ])
  return <CheckoutForm storeId={storeId} cart={cart} methods={methods} discount={discount} />
}
