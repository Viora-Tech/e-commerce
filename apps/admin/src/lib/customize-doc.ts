import type { TemplateData, TemplateSection } from '@commerce/core/theme'
import type { Config } from '@measured/puck'

/**
 * Customize edits one Puck document per template. The header and footer section
 * groups ride along as root drop zones, so a single Puck history covers the
 * whole screen (undo reaches the header too) while each part still saves to its
 * own theme_template row.
 */
export const HEADER_ZONE = 'root:header'
export const FOOTER_ZONE = 'root:footer'
export const MAIN_ZONE = 'root:default-zone'

export type CustomizeParts = { header: TemplateData; main: TemplateData; footer: TemplateData }

export type CustomizeDoc = {
  root: { props: Record<string, unknown> }
  content: TemplateSection[]
  zones: Record<string, TemplateSection[]>
}

export function composeDoc({ header, main, footer }: CustomizeParts): CustomizeDoc {
  return {
    root: { props: main.root.props ?? {} },
    content: main.content,
    zones: { [HEADER_ZONE]: header.content, [FOOTER_ZONE]: footer.content },
  }
}

const part = (content: TemplateSection[] | undefined): TemplateData => ({
  root: { props: {} },
  content: content ?? [],
  zones: {},
})

export function splitDoc(doc: CustomizeDoc): CustomizeParts {
  return {
    header: part(doc.zones[HEADER_ZONE]),
    main: { root: { props: doc.root.props ?? {} }, content: doc.content, zones: {} },
    footer: part(doc.zones[FOOTER_ZONE]),
  }
}

/** The sections of one zone of the document, as the tree lists them. */
export function zoneSections(doc: CustomizeDoc, zone: string): TemplateSection[] {
  return zone === MAIN_ZONE ? doc.content : (doc.zones[zone] ?? [])
}

const withDefaults = (sections: TemplateSection[], config: Config): TemplateSection[] =>
  sections.map((s) => {
    const defaults = config.components[s.type]?.defaultProps as Record<string, unknown> | undefined
    return defaults ? { ...s, props: { ...defaults, ...s.props } } : s
  })

/**
 * Fills each section's props with its component's `defaultProps` before Puck
 * ever sees them. Rows written before a field existed (or seeded straight
 * into the DB, like the header/footer defaults) only carry `{ id }` — Puck's
 * own render merges `defaultProps` under those props, so the section still
 * looked right, but Puck.Fields reads props as stored and showed the field
 * empty, and the very first `onChange` (Puck resolving that same merge into
 * its live state) fired a diff against nothing edited, so "Unsaved changes"
 * lit up on load. Normalising here means what's primed as "saved" already
 * matches what Puck's live state will always look like.
 */
export function normalizeDoc(doc: CustomizeDoc, config: Config): CustomizeDoc {
  return {
    ...doc,
    content: withDefaults(doc.content, config),
    zones: Object.fromEntries(
      Object.entries(doc.zones).map(([zone, sections]) => [zone, withDefaults(sections, config)]),
    ),
  }
}
