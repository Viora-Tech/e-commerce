import type { TemplateData, TemplateSection } from '@commerce/core/theme'

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
