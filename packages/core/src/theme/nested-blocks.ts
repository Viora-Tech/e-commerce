/** SOURCE OF TRUTH: blocks nested in Puck slots. WHAT how to recognise and walk a stored block at any depth without the Puck config. WHY sanitising, stripResolved and "My sections" must all see the same nested blocks. No database. */
/**
 * Blocks nested in slots (a Group's content, a tab's panel) are stored inside
 * their parent's props as `[{ type, props: { id, … } }]`. These walk every such
 * block, at any depth, without knowing the Puck config: a nested block is any
 * object with a string `type` and a `props` object holding a string `id`.
 * Pure, browser safe.
 */
export type StoredBlock = { type: string; props: Record<string, unknown> }

export const isStoredBlock = (v: unknown): v is StoredBlock =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as StoredBlock).type === 'string' &&
  typeof (v as StoredBlock).props === 'object' &&
  (v as StoredBlock).props !== null &&
  typeof (v as StoredBlock).props.id === 'string'

/**
 * `value` with `fn` applied to every stored block inside it, children first
 * (so `fn` sees a block whose slots are already mapped).
 */
export function mapNestedBlocks(value: unknown, fn: (block: StoredBlock) => StoredBlock): unknown {
  if (Array.isArray(value)) return value.map((v) => mapNestedBlocks(v, fn))
  if (typeof value !== 'object' || value === null) return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) out[k] = mapNestedBlocks(v, fn)
  return isStoredBlock(out) ? fn(out) : out
}
