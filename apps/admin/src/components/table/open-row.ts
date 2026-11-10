/**
 * SOURCE OF TRUTH: opening a table row's page from a click on the row.
 * WHAT: a left click opens the page here; a middle click, or Ctrl/⌘/Shift with a left click,
 *       opens it in a new tab, like a link. Clicks on a control inside the row (a link, button,
 *       switch, field or menu) and text selections are left alone.
 * WHY:  rows open from a click anywhere, but a middle click fires `auxclick`, never `click`, so
 *       a middle click on a row did nothing (owner, 11 Nov 2026). Shared by `LinkRow` and
 *       `ResourceTable` so every list behaves the same.
 */
import type { MouseEvent } from 'react'

/** Controls inside a row that keep their own click (a menu, a switch, the name link itself). */
export const OWN_CLICK =
  'a, button, input, select, textarea, label, [role="menuitem"], [role="switch"], [role="checkbox"]'

const MIDDLE = 1

/** Handles `onClick` and `onAuxClick` on a row; `go` opens the page in this tab. */
export function openRow(e: MouseEvent<HTMLElement>, href: string, go: (href: string) => void) {
  if (e.defaultPrevented) return
  if (e.type === 'auxclick' && e.button !== MIDDLE) return
  const target = e.target as HTMLElement
  if (target.closest(OWN_CLICK) || window.getSelection()?.toString()) return
  if (e.button === MIDDLE || e.metaKey || e.ctrlKey || e.shiftKey) {
    e.preventDefault()
    window.open(href, '_blank', 'noopener')
    return
  }
  go(href)
}
