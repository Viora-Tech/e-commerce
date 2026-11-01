import { canSubscribe, type GridRow, isConsentKey, parseTags } from './customers-bulk-model'

/** What "Change for all" can do to each column. Name and phone belong to one person each. */
export const SET_ALL_ACTIONS = {
  tags: ['addTags', 'removeTags', 'replaceTags'],
  note: ['appendNote', 'replaceNote', 'clearNote'],
  acceptsMarketing: ['subscribe', 'unsubscribe'],
  acceptsWhatsapp: ['subscribe', 'unsubscribe'],
  acceptsSms: ['subscribe', 'unsubscribe'],
} as const

export type SetAllKey = keyof typeof SET_ALL_ACTIONS
export type SetAllAction = (typeof SET_ALL_ACTIONS)[SetAllKey][number]
export type SetAllChange = { key: SetAllKey; action: SetAllAction; value: string }

/** Actions that need something typed in. */
export const needsValue = (action: SetAllAction) =>
  action !== 'clearNote' && action !== 'subscribe' && action !== 'unsubscribe'

/** The columns on screen that "Change for all" offers, in sheet order. */
export const setAllKeys = (keys: readonly string[]): SetAllKey[] =>
  keys.filter((k): k is SetAllKey => k in SET_ALL_ACTIONS)

function nextValue(row: GridRow, { key, action, value }: SetAllChange): string {
  if (key === 'tags') {
    const current = parseTags(row.tags)
    const typed = parseTags(value)
    if (action === 'addTags') return [...new Set([...current, ...typed])].join(', ')
    if (action === 'removeTags') {
      const drop = new Set(typed.map((t) => t.toLowerCase()))
      return current.filter((t) => !drop.has(t.toLowerCase())).join(', ')
    }
    return typed.join(', ')
  }
  if (key === 'note') {
    if (action === 'clearNote') return ''
    const note = row.note.trim()
    if (action === 'appendNote') return note ? `${note}\n${value.trim()}` : value.trim()
    return value.trim()
  }
  return action === 'subscribe' ? 'yes' : 'no'
}

/**
 * Erased customers never change. Subscribing needs a way to reach them: email marketing an
 * email, SMS and WhatsApp a phone (#999); unsubscribing always applies.
 */
const applies = (row: GridRow, { key, action }: SetAllChange) =>
  !row.anonymised && !(action === 'subscribe' && isConsentKey(key) && !canSubscribe(row, key))

/** One change laid over every row that can take it; the grid still needs Save to keep it. */
export function applyToAll(rows: GridRow[], change: SetAllChange): GridRow[] {
  return rows.map((r) => (applies(r, change) ? { ...r, [change.key]: nextValue(r, change) } : r))
}
