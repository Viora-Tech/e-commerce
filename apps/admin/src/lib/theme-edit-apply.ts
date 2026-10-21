import type { ThemeEditChange, ThemeValue } from '@commerce/ai/client'
import type { TemplateSection } from '@commerce/core/theme'
import { type CustomizeDoc, FOOTER_ZONE, HEADER_ZONE } from './customize-doc'

/**
 * Applies a theme edit the editor's AI drafted (`@commerce/ai` theme-outline) to the Customize
 * document: a section setting is the section's prop (an imported section's settings sit at its
 * top level), a block setting sits in `props.blocks[i].settings` (nested blocks searched too).
 * Pure: the AI panel hands the result to Puck as one `setData` with history, so Undo reverts
 * the whole edit and the draft autosave picks it up. Plain logic with no JSX.
 */

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Plain text as body copy: one paragraph per blank-line-separated part, line breaks kept. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** What a change stores: body copy becomes HTML, everything else is stored as given. */
export function storedValue(change: Pick<ThemeEditChange, 'kind' | 'value'>): ThemeValue {
  return change.kind === 'richtext' && typeof change.value === 'string'
    ? textToHtml(change.value)
    : change.value
}

type Block = { id?: unknown; settings?: unknown; blocks?: unknown } & Record<string, unknown>

/** The blocks with `blockId`'s settings changed; `found` says whether it was there. */
function editBlocks(
  raw: unknown,
  blockId: string,
  apply: (settings: Record<string, unknown>) => Record<string, unknown>,
): { blocks: unknown; found: boolean } {
  if (!Array.isArray(raw)) return { blocks: raw, found: false }
  let found = false
  const blocks = raw.map((item, i) => {
    if (found || !item || typeof item !== 'object') return item
    const block = item as Block
    // `blocksFromProps` names an id-less block by its place, and so does the outline.
    const id = typeof block.id === 'string' && block.id ? block.id : `block_${i}`
    if (id === blockId) {
      found = true
      const settings =
        block.settings && typeof block.settings === 'object'
          ? (block.settings as Record<string, unknown>)
          : {}
      return { ...block, settings: apply(settings) }
    }
    const nested = editBlocks(block.blocks, blockId, apply)
    if (!nested.found) return item
    found = true
    return { ...block, blocks: nested.blocks }
  })
  return { blocks, found }
}

function editSection(
  section: TemplateSection,
  changes: ThemeEditChange[],
  missing: ThemeEditChange[],
): TemplateSection {
  let props = { ...section.props } as Record<string, unknown>
  for (const change of changes) {
    const value = storedValue(change)
    if (!change.blockId) {
      props[change.setting] = value
      continue
    }
    const next = editBlocks(props.blocks, change.blockId, (settings) => ({
      ...settings,
      [change.setting]: value,
    }))
    if (next.found) props = { ...props, blocks: next.blocks }
    else missing.push(change)
  }
  return { ...section, props: props as TemplateSection['props'] }
}

/**
 * The document with `changes` made. `missing` lists changes whose section or block is no
 * longer on the page (removed since the AI drafted the edit); the rest still apply.
 */
export function applyThemeEdits(
  doc: CustomizeDoc,
  changes: ThemeEditChange[],
): { doc: CustomizeDoc; missing: ThemeEditChange[]; applied: number } {
  const missing: ThemeEditChange[] = []
  const touched = new Set<string>()
  const edit = (list: TemplateSection[]) =>
    list.map((section) => {
      const id = String(section.props.id)
      const mine = changes.filter((c) => c.sectionId === id)
      if (!mine.length) return section
      touched.add(id)
      return editSection(section, mine, missing)
    })
  const zones = { ...doc.zones }
  for (const zone of [HEADER_ZONE, FOOTER_ZONE]) {
    if (zones[zone]) zones[zone] = edit(zones[zone])
  }
  const next: CustomizeDoc = { ...doc, content: edit(doc.content), zones }
  for (const change of changes) if (!touched.has(change.sectionId)) missing.push(change)
  return { doc: next, missing, applied: changes.length - missing.length }
}
