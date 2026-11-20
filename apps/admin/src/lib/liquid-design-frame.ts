import type { DesignModeSection, DesignModeSelection } from '@commerce/core/theme-design-mode'
import {
  LIQUID_SECTION,
  liquidPlacement,
  type ShopifySectionSchema,
} from '@commerce/core/theme-import'
import { type CustomizeDoc, FOOTER_ZONE, HEADER_ZONE } from './customize-doc'
import type { LiquidBlockFocus } from './customize-theme-context'

/**
 * What Customize tells its "Theme scripts" frame (the store page with the imported theme's scripts
 * running, `@commerce/core/theme-design-mode`): every imported section by group, in order, as the
 * engine renders it with the unsaved settings, and the selection. Plain logic, no React.
 */

type Schemas = Record<string, ShopifySectionSchema>

/** Puck zone → Liquid's `section.location`. */
const GROUPS: [zone: string | null, location: string][] = [
  [HEADER_ZONE, 'header-group'],
  [null, 'template'],
  [FOOTER_ZONE, 'footer-group'],
]

type Placed = DesignModeSection & { puckId: string }

function placed(doc: CustomizeDoc, schemas: Schemas): Record<string, Placed[]> {
  const out: Record<string, Placed[]> = {}
  for (const [zone, location] of GROUPS) {
    const items = zone ? (doc.zones[zone] ?? []) : doc.content
    out[location] = items.flatMap((item, index) => {
      if (item.type !== LIQUID_SECTION) return []
      const props = item.props as Record<string, unknown>
      const type = typeof props.sectionType === 'string' ? props.sectionType : ''
      const placement = liquidPlacement(props, schemas[type], location, index)
      return [{ id: placement.id, placement, puckId: String(props.id ?? '') }]
    })
  }
  return out
}

/** The page's imported sections by group, each in page order. */
export function designFrameZones(
  doc: CustomizeDoc,
  schemas: Schemas,
): Record<string, DesignModeSection[]> {
  return Object.fromEntries(
    Object.entries(placed(doc, schemas)).map(([location, list]) => [
      location,
      list.map(({ id, placement }) => ({ id, placement })),
    ]),
  )
}

/** The selected section (and the block Layers opened in it), by Shopify's section id. */
export function designFrameSelection(
  doc: CustomizeDoc,
  schemas: Schemas,
  selectedId: string | null,
  focus: LiquidBlockFocus | null,
): DesignModeSelection {
  const puckId = focus?.sectionId ?? selectedId
  if (!puckId) return null
  const hit = Object.values(placed(doc, schemas))
    .flat()
    .find((s) => s.puckId === puckId)
  if (!hit) return null
  return { sectionId: hit.id, blockId: focus?.sectionId === puckId ? focus.blockId : null }
}

/** The Puck item behind a section the frame says was clicked. */
export function puckIdForSection(
  doc: CustomizeDoc,
  schemas: Schemas,
  sectionId: string,
): string | null {
  const hit = Object.values(placed(doc, schemas))
    .flat()
    .find((s) => s.id === sectionId)
  return hit?.puckId || null
}

/**
 * The store page the frame opens for the template being edited: the home page, or the product
 * chosen in the resource picker on the default product template. Null for templates whose page
 * the storefront would not draw with this template (alternates, collections and pages for now).
 */
export function designFramePath(
  template: string,
  suffix: string,
  resource: { kind: string; product?: { handle: string } } | null,
): string | null {
  if (suffix) return null
  if (template === 'home') return '/'
  if (template === 'product' && resource?.product?.handle)
    return `/products/${encodeURIComponent(resource.product.handle)}`
  return null
}
