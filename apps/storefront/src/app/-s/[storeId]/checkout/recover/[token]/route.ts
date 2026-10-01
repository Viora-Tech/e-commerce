import { settingsSecret } from '@commerce/config'
import { getCart, verifyRecoveryToken } from '@commerce/core'
import { type NextRequest, NextResponse } from 'next/server'
import { CART_COOKIE } from '@/lib/cart-cookie'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string; token: string }> }

const CART_MAX_AGE = 60 * 60 * 24 * 30

/**
 * Restores an abandoned basket from a recovery email. The token is an HMAC
 * over the cart id and an expiry, so a guessed id opens nothing. A cart that
 * has already been bought sends the shopper to the storefront instead.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { storeId, token } = await params
  const home = new URL('/', request.url)
  const verified = verifyRecoveryToken(token, settingsSecret())
  if (!verified.ok) return NextResponse.redirect(home)

  const cart = await inStore(storeId, (tx) => getCart({ storeId, tx }, verified.cartId))
  if (cart?.status !== 'open' || cart.lines.length === 0) return NextResponse.redirect(home)

  const response = NextResponse.redirect(new URL('/checkout', request.url))
  response.cookies.set(CART_COOKIE, verified.cartId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: CART_MAX_AGE,
  })
  return response
}
