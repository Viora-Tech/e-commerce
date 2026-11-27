import 'server-only'
import {
  LiquidSectionPlacementSchema,
  ProductDrop,
  renderLiquidSection,
  sectionWrapper,
} from '@commerce/core'
import { headers } from 'next/headers'
import { z } from 'zod'
import { liquidContextFor } from './liquid-context'
import { requestThemeId } from './liquid-static-section'
import { inStore } from './store-context'
import { readPreview } from './storefront-gate'

/** As many sections as the admin's canvas renders in one call. */
const MAX_SECTIONS = 60

const BodySchema = z.object({
  /** The page the sections sit on (`/`, `/products/x`), for `product` and the template. */
  path: z.string().startsWith('/').max(300),
  sections: z.array(LiquidSectionPlacementSchema).max(MAX_SECTIONS),
})

/** `/products/<handle>` → the handle, decoded. */
function productHandle(path: string): string | null {
  const raw = /^\/products\/([^/?#]+)/.exec(path)?.[1]
  if (!raw) return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return null
  }
}

/**
 * Customize's "Theme scripts" canvas (`components/theme/liquid-design-mode.tsx`): the theme's own
 * sections with the editor's unsaved settings and blocks, rendered on the store's own address so
 * their scripts can run here and never in the admin. Only with a signed preview token (the proxy
 * checks it and forwards `x-theme-preview`), rendered in design mode (`request.design_mode`, app
 * block placeholders), never cached. JSON keyed by section id, each inside Shopify's wrapper.
 */
export async function editorSectionsResponse(req: Request, storeId: string): Promise<Response> {
  const preview = readPreview(storeId, (await headers()).get('x-theme-preview'))
  if (!preview) return new Response('Not found', { status: 404 })
  const body = BodySchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return new Response('Bad request', { status: 400 })
  const { path, sections } = body.data
  const out = await inStore(storeId, async (tx) => {
    const themeId = await requestThemeId(tx, storeId)
    const ctx = themeId ? await liquidContextFor(tx, storeId, themeId, path) : null
    if (!ctx) return null
    // The editor's render: what a theme shows only in Shopify's editor shows here too.
    ctx.options.request.designMode = true
    ;(ctx.globals.request as { design_mode?: boolean }).design_mode = true
    const handle = productHandle(path)
    const product = handle ? await ctx.options.data.product(handle) : null
    if (product) ctx.globals.product = new ProductDrop(product, ctx.cache)
    const rendered: Record<string, string> = {}
    for (const section of sections) {
      const html = await renderLiquidSection(ctx, section)
      const w = sectionWrapper(ctx.bundle, section)
      rendered[section.id] = `<${w.tag} id="${w.id}" class="${w.className}">${html}</${w.tag}>`
    }
    return rendered
  })
  if (!out) return new Response('Not found', { status: 404 })
  return Response.json(out, { headers: { 'cache-control': 'no-store' } })
}
