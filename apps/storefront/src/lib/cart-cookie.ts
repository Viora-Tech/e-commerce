import { cookies } from 'next/headers'

export const CART_COOKIE = 'wc_cart'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function readCartId(): Promise<string | null> {
  const v = (await cookies()).get(CART_COOKIE)?.value
  // Ignore anything that is not one of our ids: stale or foreign cookies must not reach SQL.
  return v && UUID.test(v) ? v : null
}

export async function writeCartId(id: string): Promise<void> {
  ;(await cookies()).set(CART_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
}

export async function clearCartId(): Promise<void> {
  ;(await cookies()).delete(CART_COOKIE)
}
