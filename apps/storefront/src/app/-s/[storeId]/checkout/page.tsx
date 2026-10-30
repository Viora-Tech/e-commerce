import { loadEnv } from '@commerce/config'
import {
  checkoutOriginFor,
  checkoutTextFor,
  getCart,
  listAddresses,
  publishedPolicyLinks,
  storeCheckoutLook,
  storeCheckoutSettings,
  storefrontOriginFor,
} from '@commerce/core'
import { initiateCheckoutEventId } from '@commerce/core/pixels'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import PixelTrack from '@/components/analytics/pixel-track'
import CheckoutForm from '@/components/checkout/checkout-form'
import { emiHintContent } from '@/data/product'
import { readCartId } from '@/lib/cart-cookie'
import { withThemeLogo } from '@/lib/checkout-look'
import { MARKET_HEADERS } from '@/lib/markets'
import { readCheckoutSession } from '@/lib/checkout-session'
import { currentCustomer } from '@/lib/customer-session'
import { cartDiscountView } from '@/lib/discount-view'
import { storeEmiOffers } from '@/lib/emi-offers'
import { storeCheckoutMethods, storeOffersEmi, storePaymentMethodRules } from '@/lib/payments'
import { cartDepositTerms } from '@/lib/preorder'
import { storeSignIn } from '@/lib/sign-in-methods'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string }> }

export default async function CheckoutPage({ params }: Params) {
  const { storeId } = await params
  // On the checkout origin the cart rides in the host-only checkout session; on the store origin it
  // rides in the cart cookie. With a branded checkout origin configured (D-01 phase B) and no
  // session yet, this is the store origin, so bounce through the hand-off rather than serve the
  // checkout form where theme code lives — unless this store has no branded origin (same-origin).
  const session = await readCheckoutSession()
  if (!session) {
    const subdomain = process.env.CHECKOUT_SUBDOMAIN?.trim()
    if (subdomain) {
      const env = loadEnv(process.env)
      const { checkoutOrigin, storeOrigin } = await inStore(storeId, async (tx) => ({
        storeOrigin: await storefrontOriginFor(tx, storeId, env.STOREFRONT_URL),
        checkoutOrigin: await checkoutOriginFor(tx, storeId, subdomain, env.STOREFRONT_URL),
      }))
      if (checkoutOrigin !== storeOrigin) redirect('/checkout/start')
    }
  }
  const cartId = session?.cartId ?? (await readCartId())
  const cart = cartId ? await inStore(storeId, (tx) => getCart({ storeId, tx }, cartId)) : null
  if (cart?.status !== 'open' || cart.lines.length === 0) redirect('/cart')
  // Settings → Customer accounts can require an account: the contact step then signs the
  // shopper in with the store's own codes and providers before anything else (`checkoutAction`
  // refuses an order without one regardless).
  const [signIn, methods, discount, me, deposit, settings, policies, look, emiApp, methodRules] =
    await Promise.all([
      storeSignIn(storeId),
      inStore(storeId, (tx) => storeCheckoutMethods(tx, storeId)),
      cartDiscountView(cart.id, cart.discountCode),
      currentCustomer(storeId),
      inStore(storeId, (tx) => cartDepositTerms(tx, storeId, cart.id)),
      inStore(storeId, (tx) => storeCheckoutSettings({ tx, storeId })),
      inStore(storeId, (tx) => publishedPolicyLinks({ tx, storeId })),
      inStore(storeId, (tx) => storeCheckoutLook({ tx, storeId })).then((l) =>
        withThemeLogo(storeId, l),
      ),
      inStore(storeId, (tx) => storeEmiOffers(tx, storeId)),
      inStore(storeId, (tx) => storePaymentMethodRules(tx, storeId)),
    ])
  // The EMI line under the total: the EMI app's own minimum once installed, else the older hint's.
  const emiMinPaise = emiApp.installed
    ? (emiApp.config?.minPricePaise ?? null)
    : (await inStore(storeId, (tx) => storeOffersEmi(tx, storeId)))
      ? emiHintContent.minPricePaise
      : null
  // A signed-in shopper checks out as themselves, with their address book to pick from.
  const addresses = me ? await inStore(storeId, (tx) => listAddresses({ storeId, tx }, me.id)) : []
  const itemCount = cart.lines.reduce((n, l) => n + l.quantity, 0)
  // Settings → Checkout → Checkout content (#158): the store's wording in the shopper's language.
  const text = checkoutTextFor(
    settings.content,
    (await headers()).get(MARKET_HEADERS.locale) ?? 'en',
  )
  return (
    <>
      {/* Pixels app: InitiateCheckout, one per cart (`ic_<cartId>`). */}
      <PixelTrack
        event={{
          name: 'InitiateCheckout',
          eventId: initiateCheckoutEventId(cart.id),
          valuePaise: cart.subtotalPaise,
          contentIds: cart.lines.map((l) => l.variantId),
          numItems: itemCount,
        }}
      />
      <CheckoutForm
        // Signing in on the contact step comes back here as a different shopper: start afresh.
        key={me?.id ?? 'guest'}
        cart={cart}
        methods={methods}
        discount={discount}
        customer={me}
        addresses={addresses}
        deposit={deposit}
        settings={settings}
        text={text}
        methodRules={methodRules}
        policies={policies}
        look={look}
        emiMinPaise={emiMinPaise}
        signIn={{ methods: signIn.methods, checkout: signIn.checkout, options: signIn.options }}
      />
    </>
  )
}
