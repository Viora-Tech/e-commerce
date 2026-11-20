import type { SectionMetadata } from '@commerce/blocks/puck'
import { liquidPlacement } from '@commerce/core/theme-import'
import LiquidCanvasSection from '@/components/themes/customize/liquid-canvas-section'
import { type CustomizeDoc, FOOTER_ZONE, HEADER_ZONE } from './customize-doc'
import type { LiquidEditorInfo, useLiquidTheme } from './use-liquid-theme'

type LiquidFields = ReturnType<typeof useLiquidTheme>['fields']

/** Which group an imported section sits in (`section.location` in Liquid). */
function groupOf(doc: CustomizeDoc | null, id: unknown) {
  const inZone = (zone: string) => (doc?.zones[zone] ?? []).some((s) => s.props.id === id)
  return inZone(HEADER_ZONE) ? 'header-group' : inZone(FOOTER_ZONE) ? 'footer-group' : 'template'
}

/**
 * Customize's Puck metadata for an imported Shopify theme: the fields made from its schemas, and
 * each `LiquidSection` drawn on the canvas from the theme's own Liquid. Our own themes keep `base`.
 */
export function withLiquidCanvas(
  base: SectionMetadata,
  input: {
    themeId: string
    info: LiquidEditorInfo | null | undefined
    fields: LiquidFields
    doc: CustomizeDoc | null
  },
): SectionMetadata {
  const { themeId, info, fields, doc } = input
  if (!info || !fields) return base
  return {
    ...base,
    liquid: { fields: fields as NonNullable<SectionMetadata['liquid']>['fields'] },
    renderers: {
      ...base.renderers,
      LiquidSection: (props: Record<string, unknown>) => {
        const type = typeof props.sectionType === 'string' ? props.sectionType : ''
        return (
          <LiquidCanvasSection
            themeId={themeId}
            section={liquidPlacement(props, info.schemas[type], groupOf(doc, props.id), 0)}
          />
        )
      },
    },
  }
}
