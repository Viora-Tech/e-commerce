import type { EmailBlock } from '../emails/blocks'
import { type KeyedBlock, keyBlocks, slotLocked } from './slots'
import type { EmailTemplateDesign, FreeBlock, IntroBlock } from './types'

/** One thing to draw, in order: a merchant block, the intro, or one of the template's blocks. */
export type ResolvedBlock =
  | { kind: 'free'; block: FreeBlock }
  | { kind: 'intro'; block: IntroBlock }
  | { kind: 'slot'; key: string; block: EmailBlock }

const DEFAULT_INTRO: IntroBlock = { id: 'intro', type: 'intro' }

/**
 * A saved design laid over this message's own blocks. The design decides the order; the data
 * decides what exists. A slot whose block this message does not have is skipped. A built-in
 * block the design does not place comes back next to its neighbours unless it was removable
 * and the merchant removed it: locked blocks (order, items, code) are always drawn, whatever
 * the JSON says. The intro is always there too.
 */
export function resolveDesign(
  design: EmailTemplateDesign,
  composed: EmailBlock[],
): ResolvedBlock[] {
  const keyed = keyBlocks(composed)
  const byKey = new Map(keyed.map((k) => [k.key, k.block]))
  const used = new Set<string>()
  const out: ResolvedBlock[] = []
  for (const b of design.blocks) {
    if (b.type === 'slot') {
      const block = byKey.get(b.slot)
      if (block && !used.has(b.slot)) {
        used.add(b.slot)
        out.push({ kind: 'slot', key: b.slot, block })
      }
    } else if (b.type === 'intro') {
      if (!out.some((r) => r.kind === 'intro')) out.push({ kind: 'intro', block: b })
    } else {
      out.push({ kind: 'free', block: b })
    }
  }
  if (!out.some((r) => r.kind === 'intro')) {
    // After a leading logo, where the built-in email has it.
    const at = out.findIndex((r) => !(r.kind === 'free' && r.block.type === 'logo'))
    out.splice(at === -1 ? out.length : at, 0, { kind: 'intro', block: DEFAULT_INTRO })
  }
  const removed = new Set(design.removed)
  keyed.forEach((k, i) => {
    if (used.has(k.key)) return
    if (!slotLocked(k.key) && removed.has(k.key)) return
    insertNearNeighbours(out, keyed, i, k)
    used.add(k.key)
  })
  return out
}

/** After the closest earlier built-in block already placed; else before the next; else after the intro. */
function insertNearNeighbours(
  out: ResolvedBlock[],
  keyed: KeyedBlock[],
  index: number,
  item: KeyedBlock,
) {
  const posOf = (key: string) => out.findIndex((r) => r.kind === 'slot' && r.key === key)
  const entry: ResolvedBlock = { kind: 'slot', key: item.key, block: item.block }
  for (let j = index - 1; j >= 0; j--) {
    const p = posOf(keyed[j]?.key ?? '')
    if (p !== -1) {
      out.splice(p + 1, 0, entry)
      return
    }
  }
  for (let j = index + 1; j < keyed.length; j++) {
    const p = posOf(keyed[j]?.key ?? '')
    if (p !== -1) {
      out.splice(p, 0, entry)
      return
    }
  }
  const intro = out.findIndex((r) => r.kind === 'intro')
  out.splice(intro + 1, 0, entry)
}
