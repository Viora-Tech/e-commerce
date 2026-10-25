export type LegalSection = {
  id: string
  title: string
  /** Two short lines for the "In plain words" box. */
  plain: readonly [string, string]
  body: readonly string[]
  callout?: { title: string; text: string }
}

export type LegalDoc = {
  slug:
    | 'privacy'
    | 'terms'
    | 'cookies'
    | 'refunds'
    | 'shipping'
    | 'acceptable-use'
    | 'data-deletion'
  title: string
  lead: string
  readMinutes: number
  sections: readonly LegalSection[]
  /** Short description for search results and social cards. */
  description: string
}

type SectionInput = {
  title: string
  plain: readonly [string, string]
  body?: readonly string[]
  callout?: { title: string; text: string }
}

/** Builds numbered sections; the id (`s1`, `s2`...) drives the contents list and anchors. */
export function sections(items: readonly SectionInput[]): readonly LegalSection[] {
  return items.map((item, index) => ({
    id: `s${index + 1}`,
    title: item.title,
    plain: item.plain,
    body: item.body ?? [],
    ...(item.callout ? { callout: item.callout } : {}),
  }))
}
