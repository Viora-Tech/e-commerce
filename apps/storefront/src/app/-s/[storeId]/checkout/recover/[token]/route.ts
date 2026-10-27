import { settingsSecret } from '@commerce/config'
import { getCart, verifyRecoveryToken } from '@commerce/core'
import type { NextRequest } from 'next/server'
import { CART_COOKIE } from '@/lib/cart-cookie'
import { redirectTo } from '@/lib/redirect'
import { withEvlog } from '@/lib/request-log'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string; token: string }> }

const CART_MAX_AGE = 60 * 60 * 24 * 30

/**
 * Restores an abandoned basket from a recovery email. The token is an HMAC
 * over the cart id and an expiry, so a guessed id opens nothing. A cart that
 * has already been bought sends the shopper to the storefront instead.
 */
export const GET = withEvlog(async (_request: NextRequest, { params }: Params) => {
  const { storeId, token } = await params
  const verified = verifyRecoveryToken(token, settingsSecret())
  if (!verified.ok) return redirectTo('/')

  const cart = await inStore(storeId, (tx) => getCart({ storeId, tx }, verified.cartId))
  if (cart?.status !== 'open' || cart.lines.length === 0) return redirectTo('/')

  const response = redirectTo('/checkout')
  response.cookies.set(CART_COOKIE, verified.cartId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: CART_MAX_AGE,
  })
  return response
})
