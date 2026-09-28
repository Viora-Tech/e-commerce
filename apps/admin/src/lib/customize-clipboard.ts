import type { TemplateSection } from '@commerce/core/theme'

/**
 * The editor's block clipboard (Cmd/Ctrl+C and V): a copy of one block,
 * children and all. Kept in memory and in this tab's sessionStorage, so a
 * copy survives switching templates; pasting always makes fresh ids.
 */
const KEY = 'customize.clipboard'
let memory: TemplateSection | null = null

export function copyBlock(block: TemplateSection): void {
  memory = structuredClone(block)
  try {
    sessionStorage.setItem(KEY, JSON.stringify(memory))
  } catch {
    // Private mode or full storage: the in-memory copy still works in this page.
  }
}

export function copiedBlock(): TemplateSection | null {
  if (memory) return memory
  try {
    const raw = sessionStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as TemplateSection) : null
    if (parsed && typeof parsed.type === 'string' && typeof parsed.props?.id === 'string') {
      memory = parsed
    }
  } catch {
    return null
  }
  return memory
}
