/**
 * A section link as stored in a theme doc: `{ label, href, newTab? }`.
 * `href` is a plain string (a storefront path such as `/products/<handle>`,
 * or a pasted `https://` address), exactly as before. `newTab` is optional
 * and only set by the editor's "Open in a new tab" switch, so older docs
 * without it keep opening links in the same tab.
 */
export type SectionLink = { label?: string; href?: string; newTab?: boolean | undefined }

/** The extra `<a>` attributes for a link that opens in a new tab (none otherwise). */
export function linkTarget(link: unknown): { target?: '_blank'; rel?: string } {
  const newTab = typeof link === 'object' && link !== null && (link as SectionLink).newTab === true
  return newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {}
}
