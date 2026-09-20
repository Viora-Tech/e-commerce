import { getCart } from '@commerce/core'
import { redirect } from 'next/navigation'
import { readCartId } from '@/lib/cart-cookie'
import { storePaymentProviders } from '@/lib/payments'
import { inStore } from '@/lib/store-context'
import { CheckoutForm } from './checkout-form'

type Params = { params: Promise<{ storeId: string }> }

export default async function CheckoutPage({ params }: Params) {
  const { storeId } = await params
  const cartId = await readCartId()
  const cart = cartId ? await inStore(storeId, (tx) => getCart({ storeId, tx }, cartId)) : null
  if (cart?.status !== 'open' || cart.lines.length === 0) redirect('/cart')
  const methods = await inStore(storeId, async (tx) =>
    (await storePaymentProviders(tx, storeId)).map((p) => ({ id: p.id, label: p.label })),
  )
  return <CheckoutForm storeId={storeId} cart={cart} methods={methods} />
}
