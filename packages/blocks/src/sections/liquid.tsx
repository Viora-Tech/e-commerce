import type { ComponentConfig, Fields } from '@puckeditor/core'
import type { SectionMetadata, SectionSettings } from './dynamic'

/**
 * SOURCE OF TRUTH KEYWORDS: LiquidSection, imported Shopify section
 * WHAT:  The one Puck component every section of an imported Shopify theme is stored as.
 *        It carries the section's type, key, settings and blocks; the fields come from
 *        the theme's `{% schema %}` (built by `@commerce/core/theme-import`, handed in
 *        through `metadata.liquid`), and the HTML from the Liquid engine through the
 *        `LiquidSection` renderer, exactly like the dynamic sections.
 * WHY:   Blocks cannot depend on core (core depends on blocks), and a theme's sections
 *        are only known once it is imported, so both the fields and the render arrive
 *        at runtime.
 */
export const liquidSectionConfig: ComponentConfig<SectionSettings> = {
  label: 'Imported section',
  // Replaced per section by `resolveFields`; one hidden field so the inspector knows it has settings.
  fields: { sectionType: { type: 'text', label: 'Section type', visible: false } },
  defaultProps: { sectionType: '', sectionKey: '', blocks: [] },
  resolveFields: (data, { metadata }) => {
    const meta = metadata as SectionMetadata
    const type = typeof data.props.sectionType === 'string' ? data.props.sectionType : ''
    return (meta.liquid?.fields[type] ?? {}) as Fields<SectionSettings>
  },
  render: ({ puck, ...props }) => {
    const meta = (puck?.metadata ?? {}) as SectionMetadata
    return <>{meta.renderers?.LiquidSection?.(props) ?? null}</>
  },
}
