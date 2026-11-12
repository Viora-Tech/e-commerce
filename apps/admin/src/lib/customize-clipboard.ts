import type { TemplateSection } from '@commerce/core/theme'
import { type StorageScope, scopedStorageKey } from '@/lib/storage-scope'

/**
 * The editor's block clipboard (Cmd/Ctrl+C and V): a copy of one block,
 * children and all. Kept in memory and in this tab's sessionStorage, so a
 * copy survives switching templates; pasting always makes fresh ids. Both are
 * per store (blocks point at that store's products and images), so a copy
 * never pastes into another store opened in the same tab.
 */
const KEY = 'customize.clipboard'
let memory: { key: string; block: TemplateSection } | null = null

export function copyBlock(scope: StorageScope | null, block: TemplateSection): void {
  const key = scopedStorageKey(KEY, scope, { perUser: false })
  if (!key) return
  memory = { key, block: structuredClone(block) }
  try {
    sessionStorage.setItem(key, JSON.stringify(memory.block))
  } catch {
    // Private mode or full storage: the in-memory copy still works in this page.
  }
}

export function copiedBlock(scope: StorageScope | null): TemplateSection | null {
  const key = scopedStorageKey(KEY, scope, { perUser: false })
  if (!key) return null
  if (memory?.key === key) return memory.block
  try {
    const raw = sessionStorage.getItem(key)
    const parsed = raw ? (JSON.parse(raw) as TemplateSection) : null
    if (parsed && typeof parsed.type === 'string' && typeof parsed.props?.id === 'string') {
      memory = { key, block: parsed }
      return parsed
    }
  } catch {
    return null
  }
  return null
}
