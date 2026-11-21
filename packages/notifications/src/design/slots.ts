import type { EmailBlock } from '../emails/blocks'

/**
 * The template's own blocks as named slots: `<kind>#<n>`, the n-th block of that kind in the
 * composer's output. The same data gives the same keys, so a saved design can point at them.
 */
export type KeyedBlock = { key: string; block: EmailBlock }

export function keyBlocks(blocks: EmailBlock[]): KeyedBlock[] {
  const seen = new Map<string, number>()
  return blocks.map((block) => {
    const n = seen.get(block.kind) ?? 0
    seen.set(block.kind, n + 1)
    return { key: `${block.kind}#${n}`, block }
  })
}

export const slotKind = (key: string): string => key.split('#')[0] ?? key

/**
 * Built-in blocks a merchant may remove: a plain line and a divider carry no order data.
 * Everything else (ticket, items, totals, code, coupon, address, buttons to the order) is
 * locked: it can move but never goes, and always shows the real order.
 */
const REMOVABLE = new Set(['text', 'divider'])

export const slotLocked = (key: string): boolean => !REMOVABLE.has(slotKind(key))

/** A slot key as the editor and the API accept it. */
export const SLOT_KEY = /^[a-z]{2,20}#\d{1,2}$/
