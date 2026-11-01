/**
 * The rows ticked in the list on screen, for the AI assistant. A list publishes its selection
 * with the page's path; the assistant reads it when the merchant sends a message on that same
 * page, so "raise these by ₹500" means the rows ticked now, never products named earlier in the
 * conversation (#983). Module state: one list is on screen at a time.
 */
import { ASSISTANT_MAX_SELECTED } from '@commerce/ai/client'

let current: { path: string; ids: string[] } = { path: '', ids: [] }

/** Called by a list whenever its ticked rows change; an empty list clears it. */
export function publishListSelection(path: string, ids: readonly string[]): void {
  current = { path, ids: ids.slice(0, ASSISTANT_MAX_SELECTED) }
}

/** The ids ticked in the list at `path`, or none when another page published them. */
export function listSelection(path: string): string[] {
  return current.path === path ? current.ids : []
}
