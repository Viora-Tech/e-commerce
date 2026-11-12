import type { DeliveryEstimate } from '@commerce/core'
import { ISLAND_ACTIONS, type IslandActionName } from '@/lib/hono-island/names'

/**
 * The browser side of the three server actions the buy box uses, with their signatures: the
 * island bundle (`../../scripts/build-island.ts`) loads this module in place of
 * `@/lib/cart-actions`, `@/lib/shipping-actions` and `@/lib/back-in-stock-actions`. Each posts
 * JSON to `/theme-actions/island-*` on the store's own origin, where the Next storefront runs the
 * real action (`apps/storefront/src/lib/hono-island/actions.ts`). A market prefix is never in
 * the path: Hono pages are not drawn in subfolder markets.
 */

export type NotifyMeState = { status: 'idle' | 'done' | 'error'; error?: string }

async function post<T>(name: IslandActionName, body: unknown): Promise<T> {
  const res = await fetch(`/theme-actions/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${name}: ${res.status}`)
  return (await res.json()) as T
}

export async function addLineAction(
  variantId: string,
  quantity: number,
): Promise<{ error: string } | undefined> {
  const out = await post<{ error?: string }>(ISLAND_ACTIONS.add, { variantId, quantity })
  return typeof out.error === 'string' ? { error: out.error } : undefined
}

export function estimateDeliveryAction(pincode: string): Promise<DeliveryEstimate> {
  return post<DeliveryEstimate>(ISLAND_ACTIONS.delivery, { pincode })
}

export function notifyMeAction(
  variantId: string,
  _state: NotifyMeState,
  form: FormData,
): Promise<NotifyMeState> {
  const field = (name: string) => {
    const v = form.get(name)
    return typeof v === 'string' ? v : undefined
  }
  return post<NotifyMeState>(ISLAND_ACTIONS.notify, {
    variantId,
    email: field('email'),
    phone: field('phone'),
  }).catch(() => ({ status: 'error', error: 'network' }))
}
