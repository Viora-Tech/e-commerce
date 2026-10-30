/** SOURCE OF TRUTH: Home's to-do items — WHAT: the counted to-dos Home can show and which ones a store has hidden / WHY: one list for the cards, the "Edit to-dos" dialog and the saved setting (#1006) */
/**
 * The to-do cards Home can show, each counted from the store's own data. A store hides the ones
 * it does not want (`store.preferences.homeTodos.hidden`); everything else shows whenever its
 * count is above zero. Storing the hidden ones means a new item turns on for every store.
 */
export const HOME_TODOS = [
  'ship',
  'unpaid',
  'upi',
  'balance',
  'preorderShip',
  'returns',
  'gst',
  'stock',
] as const

export type HomeTodo = (typeof HOME_TODOS)[number]

export type HomeTodoSettings = { hidden: HomeTodo[] }

/** A stored setting back as known items only; anything missing or broken shows everything. */
export function parseHomeTodos(value: unknown): HomeTodoSettings {
  const raw =
    value && typeof value === 'object' ? (value as { hidden?: unknown }).hidden : undefined
  const list = Array.isArray(raw) ? raw : []
  return { hidden: HOME_TODOS.filter((t) => list.includes(t)) }
}
