/** SOURCE OF TRUTH: "My sections" rules. WHAT the saved-section shape, its limits, what is stripped before saving and how a copy gets fresh ids. WHY the editor and the API must agree on what a saved section is. No database. */
import { LIQUID_SECTION } from '../theme-import/fields'
import { sanitizeTemplateEmbeds } from './embeds'
import { isStoredBlock, mapNestedBlocks, type StoredBlock } from './nested-blocks'
import type { TemplateSection } from './templates-data'

/**
 * "My sections": a store's own library of sections a merchant built (a Group
 * with its children, or any section) and saved to reuse. Browser safe; the
 * admin imports it to insert a copy, the server to validate before storing.
 *
 * Stored on the store row, `store.preferences.customSections` (no migration),
 * newest first, capped so the row stays small (`CUSTOM_SECTION_LIMITS`).
 */

export type CustomSection = {
  id: string
  name: string
  /** First image found inside the section, for the Add panel's tile; null for none. */
  thumbnail: string | null
  /** The section as stored: `{ type, props }`, slots and all, with editor-only data removed. */
  block: StoredBlock
  createdAt: string
  /**
   * The theme it was saved from, kept only when it holds an imported Shopify section
   * (`LiquidSection`, at any depth): those render only with that theme's Liquid files, so the
   * section is offered only while editing that theme. Absent for sections built from our own
   * blocks, which work in every theme. See `customSectionsForTheme`.
   */
  themeId?: string
}

export const CUSTOM_SECTION_LIMITS = {
  /** Sections one store can keep. */
  count: 40,
  /** One section, serialised. */
  bytes: 64_000,
  /** All of them together. */
  totalBytes: 1_000_000,
  name: 60,
  /** How deep slots may nest inside one saved section. */
  depth: 8,
} as const

export class CustomSectionProblem extends Error {}

/** Keys the editor adds that never belong in a saved copy. */
const EDITOR_ONLY = new Set(['resolved', '_hidden'])

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length

/** How many levels of nested blocks a block holds (a lone element is 1). */
function blockDepth(value: unknown): number {
  if (Array.isArray(value)) return Math.max(0, ...value.map(blockDepth))
  if (typeof value !== 'object' || value === null) return 0
  const inner = Math.max(0, ...Object.values(value).map(blockDepth))
  return isStoredBlock(value) ? inner + 1 : inner
}

/** The first `https` or site-path image `url` inside a block, depth first. */
function firstImageUrl(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const v of value) {
      const found = firstImageUrl(v)
      if (found) return found
    }
    return null
  }
  if (typeof value !== 'object' || value === null) return null
  const url = (value as { url?: unknown }).url
  const alt = (value as { alt?: unknown }).alt
  if (typeof url === 'string' && typeof alt === 'string' && /^(https:\/\/|\/(?!\/))/.test(url)) {
    return url
  }
  for (const v of Object.values(value)) {
    const found = firstImageUrl(v)
    if (found) return found
  }
  return null
}

/**
 * A section ready to store: editor-only keys removed at every depth, Custom
 * HTML sanitised, name trimmed, checked against the limits. Throws
 * `CustomSectionProblem` with a message the merchant can act on.
 */
export function prepareCustomSection(input: { name: string; block: unknown }): {
  name: string
  thumbnail: string | null
  block: StoredBlock
} {
  const name = input.name.trim().slice(0, CUSTOM_SECTION_LIMITS.name)
  if (!name) throw new CustomSectionProblem('Give the section a name')
  if (!isStoredBlock(input.block)) throw new CustomSectionProblem('Choose a section to save')
  const clean = mapNestedBlocks(input.block, (b) => ({
    ...b,
    props: Object.fromEntries(Object.entries(b.props).filter(([k]) => !EDITOR_ONLY.has(k))),
  })) as StoredBlock
  const { content } = sanitizeTemplateEmbeds({
    root: { props: {} },
    content: [clean as TemplateSection],
  })
  const block = content[0] as StoredBlock
  if (blockDepth(block) > CUSTOM_SECTION_LIMITS.depth) {
    throw new CustomSectionProblem('This section is nested too deeply to save')
  }
  if (bytes(block) > CUSTOM_SECTION_LIMITS.bytes) {
    throw new CustomSectionProblem('This section is too large to save. Remove a few blocks first.')
  }
  return { name, thumbnail: firstImageUrl(block), block }
}

/** Default id maker: `<Type>-<uuid>`, the shape Puck's own ids take. */
const newBlockId = (type: string) => `${type}-${globalThis.crypto.randomUUID()}`

/**
 * A fresh copy of a saved section to insert: every block in it, at every
 * depth, gets a new id, so the copy never shares ids with the page, the
 * library or another copy.
 */
export function instantiateCustomSection(
  block: StoredBlock,
  makeId: (type: string) => string = newBlockId,
): StoredBlock {
  return withFreshBlockIds(block, makeId)
}

/**
 * Any value (an array item holding a slot, say) with every block nested in it
 * given a new id: what duplicating a tab or a column needs.
 */
export function withFreshBlockIds<T>(value: T, makeId: (type: string) => string = newBlockId): T {
  return mapNestedBlocks(structuredClone(value), (b) => ({
    ...b,
    props: { ...b.props, id: makeId(b.type) },
  })) as T
}

/** True when the block is, or holds at any depth, an imported Shopify section (`LiquidSection`). */
export function hasLiquidSection(block: unknown): boolean {
  let found = false
  mapNestedBlocks(block, (b) => {
    if (b.type === LIQUID_SECTION) found = true
    return b
  })
  return found
}

/**
 * The saved sections the Add panel offers while editing one theme. Sections built only from our
 * own blocks show in every theme. A section holding an imported Shopify section shows only in the
 * theme it was saved from (`themeId`). One saved before the theme was recorded (no `themeId`)
 * cannot be traced to its theme, so it shows only in imported themes, the only ones that can
 * render Liquid; in our own themes it would draw blank.
 */
export function customSectionsForTheme(
  list: CustomSection[],
  theme: { id: string; imported: boolean },
): CustomSection[] {
  return list.filter((s) => {
    if (!hasLiquidSection(s.block)) return true
    return s.themeId ? s.themeId === theme.id : theme.imported
  })
}

/** The stored list, dropping anything malformed. */
export function parseCustomSections(raw: unknown): CustomSection[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (s): s is CustomSection =>
      typeof s === 'object' &&
      s !== null &&
      typeof (s as CustomSection).id === 'string' &&
      typeof (s as CustomSection).name === 'string' &&
      isStoredBlock((s as CustomSection).block),
  )
}

/** The list after adding `section` first, or a problem when it would break a limit. */
export function withCustomSection(list: CustomSection[], section: CustomSection): CustomSection[] {
  if (list.length >= CUSTOM_SECTION_LIMITS.count) {
    throw new CustomSectionProblem(
      `You can keep ${CUSTOM_SECTION_LIMITS.count} sections. Delete one to save another.`,
    )
  }
  const next = [section, ...list]
  if (bytes(next) > CUSTOM_SECTION_LIMITS.totalBytes) {
    throw new CustomSectionProblem('Your saved sections are full. Delete one to save another.')
  }
  return next
}
