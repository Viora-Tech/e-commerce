import type { NewsletterState } from '@commerce/blocks/puck'
import { resolveThemeVariantId } from '@commerce/core'
import { addLineAction, cartCountAction } from '@/lib/cart-actions'
import { submitContact } from '@/lib/contact-actions'
import { renderStaticLiquidSection } from '@/lib/liquid-theme'
import { requestPriceCents } from '@/lib/market-pricing'
import { localizationAction, marketSuggestionAction } from '@/lib/market-switch'
import { subscribeAction } from '@/lib/newsletter-actions'
import { recordConsentAction } from '@/lib/privacy-actions'
import { recommendationsResponse } from '@/lib/recommendations-route'
import { withEvlog } from '@/lib/request-log'
import { requestedSections, validSectionId } from '@/lib/section-rendering'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string; action: string }> }

/**
 * Where an imported Shopify theme's forms and scripts land (the behaviour swap, see
 * `lib/liquid-shim.ts` and the swap table in `@commerce/core` theme-import). Each
 * action runs on our own feature: our cart, our subscriber list, our section renderer.
 * Nothing here emulates Shopify's API; the theme only keeps its look.
 */

const notFound = () => new Response('Not found', { status: 404 })

/** Back to the page the form was on (same origin only), with Shopify's `form_posted` flag. */
function backTo(req: Request, posted: string | null): Response {
  const referer = req.headers.get('referer')
  const self = new URL(req.url)
  let target = new URL('/', self)
  if (referer) {
    const from = new URL(referer)
    if (from.host === req.headers.get('host')) target = new URL(from.pathname + from.search, self)
  }
  if (posted) target.searchParams.set('form_posted', posted)
  return new Response(null, { status: 303, headers: { location: target.pathname + target.search } })
}

const wantsJson = (req: Request) => (req.headers.get('accept') ?? '').includes('application/json')

/** `id` + `quantity` from a theme's product form, or `{ items: [...] }` JSON from its script. */
async function cartLines(req: Request): Promise<{ id: string; quantity: number }[]> {
  const type = req.headers.get('content-type') ?? ''
  if (type.includes('application/json')) {
    const body = (await req.json().catch(() => null)) as {
      id?: unknown
      quantity?: unknown
      items?: { id?: unknown; quantity?: unknown }[]
    } | null
    const items = body?.items ?? (body ? [body] : [])
    return items.flatMap((i) =>
      typeof i.id === 'string' || typeof i.id === 'number'
        ? [{ id: String(i.id), quantity: Number(i.quantity) || 1 }]
        : [],
    )
  }
  const form = await req.formData().catch(() => null)
  const id = form?.get('id')
  return typeof id === 'string' && id ? [{ id, quantity: Number(form?.get('quantity')) || 1 }] : []
}

export const POST = withEvlog(async (req: Request, { params }: Params) => {
  const { storeId, action } = await params
  if (action === 'cart-add') {
    const lines = await cartLines(req)
    if (lines.length === 0) return new Response('Choose a product', { status: 422 })
    try {
      for (const line of lines.slice(0, 20)) {
        // Themes post the whole-number id they were shown; our cart wants the variant's UUID.
        const variantId = await inStore(storeId, (tx) => resolveThemeVariantId(tx, line.id))
        if (!variantId) throw new Error('unknown variant')
        const refused = await addLineAction(variantId, Math.min(line.quantity, 99))
        if (refused) throw new Error(refused.error)
      }
    } catch {
      return wantsJson(req)
        ? Response.json({ status: 422, description: 'Could not add this item' }, { status: 422 })
        : backTo(req, null)
    }
    return wantsJson(req)
      ? Response.json({ ok: true })
      : new Response(null, { status: 303, headers: { location: '/cart' } })
  }
  if (action === 'newsletter') {
    const form = await req.formData().catch(() => null)
    const email = form?.get('contact[email]') ?? form?.get('email')
    const data = new FormData()
    if (typeof email === 'string') data.set('email', email)
    const result = await subscribeAction({ status: 'idle' } as NewsletterState, data)
    return backTo(req, result.status === 'done' ? 'customer' : 'customer_error')
  }
  if (action === 'contact') {
    const form = await req.formData().catch(() => null)
    if (!form) return backTo(req, 'contact_error')
    const referer = req.headers.get('referer')
    const path = referer ? new URL(referer).pathname : ''
    const outcome = await submitContact(form, path)
    return backTo(req, outcome === 'posted' ? 'contact' : 'contact_error')
  }
  // The cookie banner's answer on a plain HTML page (`lib/plain-html/islands.ts`): the proof row
  // and the cookie, as the React consent manager's action stores them.
  if (action === 'consent') {
    const body = (await req.json().catch(() => null)) as {
      analytics?: unknown
      marketing?: unknown
    } | null
    return Response.json(
      await recordConsentAction({
        analytics: body?.analytics === true,
        marketing: body?.marketing === true,
      }),
    )
  }
  // The theme's country and language selector: the shopper's market (`lib/market-switch.ts`).
  if (action === 'localization') return localizationAction(req, storeId)
  return notFound()
})

export const GET = withEvlog(async (req: Request, { params }: Params) => {
  const { storeId, action } = await params
  if (action === 'cart') {
    // The total as the theme's Liquid prices are: the market's currency, in hundredths.
    const cart = await cartCountAction()
    return Response.json({
      ...cart,
      total_price: await requestPriceCents(storeId, cart.total_price),
    })
  }
  // The "Shopping from …?" banner: this visitor's market suggestion, never cached.
  if (action === 'market-suggestion') return marketSuggestionAction(req, storeId)
  // Older pages' shim sent recommendations here; the store-domain route answers them now.
  if (action === 'recommendations') return recommendationsResponse(req, storeId, false)
  if (action === 'section') {
    const url = new URL(req.url)
    const path = url.searchParams.get('path') ?? '/'
    const list = url.searchParams.get('sections')
    // `?sections=a,b`: JSON keyed by every section asked for, null for one there is none of.
    if (list !== null && !url.searchParams.has('section_id')) {
      const ids = requestedSections(list)
      if (ids.length === 0) return notFound()
      const rendered = await inStore(storeId, async (tx) => {
        const out: Record<string, string | null> = {}
        for (const id of ids) {
          out[id] = validSectionId(id)
            ? await renderStaticLiquidSection(tx, storeId, id, path)
            : null
        }
        return out
      })
      return Response.json(rendered)
    }
    const type = url.searchParams.get('section_id') ?? ''
    if (!validSectionId(type)) return notFound()
    const html = await inStore(storeId, (tx) => renderStaticLiquidSection(tx, storeId, type, path))
    if (html === null) return notFound()
    // `?section_id=` asks for the HTML itself; a page from before the list (`&sections=1`) for
    // JSON keyed by that one section.
    return url.searchParams.get('sections')
      ? Response.json({ [type]: html })
      : new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  }
  return notFound()
})
