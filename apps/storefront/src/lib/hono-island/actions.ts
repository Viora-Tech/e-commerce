import 'server-only'
import { notifyMeAction } from '../back-in-stock-actions'
import { addLineAction } from '../cart-actions'
import { estimateDeliveryAction } from '../shipping-actions'
import { ISLAND_ACTIONS } from './names'
import { sameOrigin } from './route'

/**
 * The buy box island's calls on a Hono product page, answered with the very server actions the
 * Next product page passes to `ProductView` (`addLineAction`, `estimateDeliveryAction`,
 * `notifyMeAction`), as JSON. Same origin only: the body must be JSON (a cross-site page cannot
 * send that without a preflight this route never answers) and a present `Origin` must be this host,
 * as Next checks for its server actions.
 */

type Body = Record<string, unknown>

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

/** The answer for an island action, or null when `action` is not one (the route answers 404). */
export async function islandAction(req: Request, action: string): Promise<Response | null> {
  const known = (Object.values(ISLAND_ACTIONS) as string[]).includes(action)
  if (!known) return null
  if (!sameOrigin(req)) return new Response('Forbidden', { status: 403 })
  const body = ((await req.json().catch(() => null)) ?? {}) as Body
  if (action === ISLAND_ACTIONS.add) {
    const variantId = str(body.variantId, 64)
    if (!variantId) return Response.json({ error: 'invalid' }, { status: 422 })
    const quantity = Math.min(99, Math.max(1, Math.floor(Number(body.quantity) || 1)))
    // `{ error }` is a refusal the shopper can act on; undefined is done (sent as `{}`).
    return Response.json((await addLineAction(variantId, quantity)) ?? {})
  }
  if (action === ISLAND_ACTIONS.delivery) {
    return Response.json(await estimateDeliveryAction(str(body.pincode, 12)))
  }
  const form = new FormData()
  if (typeof body.email === 'string') form.set('email', str(body.email, 320))
  if (typeof body.phone === 'string') form.set('phone', str(body.phone, 32))
  return Response.json(await notifyMeAction(str(body.variantId, 64), { status: 'idle' }, form))
}
