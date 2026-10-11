/** SOURCE OF TRUTH: shop-setup tasks, their order, and the "what is next" rule (pure, no database) */
/** Setup tasks, in the order a new shop should do them. */
export const SETUP_ITEM_IDS = [
  'store',
  'payments',
  'shipping',
  'taxes',
  'domain',
  'notifications',
  'policies',
] as const

export type SetupItemId = (typeof SETUP_ITEM_IDS)[number]

export type SetupItem = { id: SetupItemId; done: boolean }

export type SetupProgress = {
  items: SetupItem[]
  done: number
  total: number
  /** The next task to do; null when everything is done. */
  next: SetupItemId | null
}

/**
 * The next task to do: the first undone one after `after` (the task just saved), wrapping
 * round to the start; without `after`, the first undone. Null when all are done.
 */
export function pickNextSetup(items: SetupItem[], after?: SetupItemId): SetupItemId | null {
  const undone = (id: SetupItemId) => items.some((i) => i.id === id && !i.done)
  const from = after ? SETUP_ITEM_IDS.indexOf(after) + 1 : 0
  const order = [...SETUP_ITEM_IDS.slice(from), ...SETUP_ITEM_IDS.slice(0, from)]
  return order.find(undone) ?? null
}

/** Items plus counts and the next task, as Home, Settings and the after-save prompt read them. */
export function setupProgress(items: SetupItem[], after?: SetupItemId): SetupProgress {
  return {
    items,
    done: items.filter((i) => i.done).length,
    total: items.length,
    next: pickNextSetup(items, after),
  }
}
