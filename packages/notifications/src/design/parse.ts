import { parseBlock } from './parse-blocks'
import { isObj, parseStyles, str } from './parse-style'
import { SLOT_KEY, slotLocked } from './slots'
import {
  DESIGN_VERSION,
  DESIGN_VERSIONS,
  type DesignBlock,
  type EmailTemplateDesign,
  DESIGN_LIMITS as L,
} from './types'

export { isSafeImage, isSafeLink } from './parse-blocks'

/**
 * The send-time reading of a stored design. The API checks on save (`checkEmailDesign`, used by
 * core's `EmailTemplateDesignSchema`); this runs again on every send because a stored row can be
 * old, hand-edited or broken. Null for anything that is not a design; a single bad block is
 * dropped. A version 1 design comes back as version 2: every field it lacks is optional.
 */
export function parseEmailDesign(raw: unknown): EmailTemplateDesign | null {
  if (!isObj(raw) || !DESIGN_VERSIONS.includes(raw.version as number)) return null
  if (!Array.isArray(raw.blocks)) return null
  try {
    if (JSON.stringify(raw).length > L.bytes) return null
  } catch {
    return null
  }
  const ids = new Set<string>()
  const blocks: DesignBlock[] = []
  for (const b of raw.blocks.slice(0, L.blocks)) {
    const block = parseBlock(b)
    if (!block || ids.has(block.id)) continue
    ids.add(block.id)
    blocks.push(block)
  }
  // One intro only; a second is ignored.
  const firstIntro = blocks.findIndex((b) => b.type === 'intro')
  const cleaned = blocks.filter((b, i) => b.type !== 'intro' || i === firstIntro)
  const removed = Array.isArray(raw.removed)
    ? raw.removed
        .filter((k): k is string => typeof k === 'string' && SLOT_KEY.test(k))
        .slice(0, L.blocks)
    : []
  const styles = parseStyles(raw.styles)
  return {
    version: DESIGN_VERSION,
    subject: str(raw.subject, L.subject)?.trim() || undefined,
    ...(styles ? { styles } : {}),
    blocks: cleaned,
    removed,
  }
}

export type DesignCheck =
  | { ok: true; design: EmailTemplateDesign }
  | { ok: false; issues: string[] }

const rawBlocks = (raw: unknown): unknown[] =>
  isObj(raw) && Array.isArray(raw.blocks) ? raw.blocks : []

/** What a block lost when it was read: a link or picture that was not safe, a dropped cell. */
function lost(raw: unknown, block: DesignBlock): string | null {
  if (!isObj(raw)) return null
  const has = (k: string) => typeof raw[k] === 'string' && (raw[k] as string).trim() !== ''
  const b = block as Record<string, unknown>
  for (const [k, v] of Object.entries(raw)) {
    const kept = b[k]
    if (k === 'html' || typeof v !== 'string' || typeof kept !== 'string') continue
    if (kept.length < v.trim().length) return `${k} is too long`
  }
  if (has('href') && !b.href) return 'Links must start with https://, http:// or mailto:'
  if (block.type === 'hero' && has('buttonUrl') && !block.buttonUrl) {
    return 'Links must start with https://, http:// or mailto:'
  }
  if (block.type === 'footer' && Array.isArray(raw.links)) {
    if (raw.links.length !== (block.links?.length ?? 0)) return 'A footer link is not valid'
  }
  if (block.type === 'columns' && Array.isArray(raw.cells)) {
    const want = raw.cells
      .slice(0, 3)
      .reduce<number>((n, c) => n + (Array.isArray(c) ? c.length : 0), 0)
    const got = block.cells.reduce((n, c) => n + c.length, 0)
    if (want !== got || raw.cells.length > 3) return 'A block inside the columns is not valid'
  }
  return null
}

/**
 * What Save accepts: the same reading as a send, but strict. Anything a send would drop or
 * change (an unknown block, an unsafe link or picture, a duplicate id, a second intro, a locked
 * block listed as removed, a design too large) is an issue instead.
 */
export function checkEmailDesign(raw: unknown): DesignCheck {
  if (!isObj(raw) || !DESIGN_VERSIONS.includes(raw.version as number)) {
    return { ok: false, issues: ['Not an email design'] }
  }
  const issues: string[] = []
  const list = rawBlocks(raw)
  if (list.length > L.blocks) issues.push(`At most ${L.blocks} blocks`)
  const ids = new Set<string>()
  for (const b of list) {
    const id = isObj(b) && typeof b.id === 'string' ? b.id : '?'
    const block = parseBlock(b)
    if (!block || !/^[A-Za-z0-9_#-]+$/.test(block.id)) {
      issues.push(`Block ${id} is not valid: check its words, links and pictures`)
      continue
    }
    const problem = lost(b, block)
    if (problem) issues.push(`${id}: ${problem}`)
    const inner = block.type === 'columns' ? block.cells.flat().map((c) => c.id) : []
    for (const k of [block.id, ...inner]) {
      if (ids.has(k)) issues.push(`Duplicate block id ${k}`)
      ids.add(k)
    }
  }
  if (list.filter((b) => isObj(b) && b.type === 'intro').length > 1)
    issues.push('Only one intro block')
  const removed = Array.isArray(raw.removed) ? raw.removed : []
  for (const key of removed) {
    if (typeof key !== 'string' || !SLOT_KEY.test(key)) issues.push('A removed block is not valid')
    else if (slotLocked(key)) issues.push(`${key} cannot be removed`)
  }
  if (typeof raw.subject === 'string' && raw.subject.length > L.subject)
    issues.push('The subject is too long')
  if (JSON.stringify(raw).length > L.bytes) issues.push('The design is too large')
  if (issues.length > 0) return { ok: false, issues }
  const design = parseEmailDesign(raw)
  return design ? { ok: true, design } : { ok: false, issues: ['Not an email design'] }
}
