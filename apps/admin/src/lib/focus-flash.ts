/** Classes that ring a field for a moment after a link or audit row sends the merchant to it. */
const FLASH = ['ring-2', 'ring-ring', 'ring-offset-2', 'transition-shadow']

const FLASH_MS = 2_000

/**
 * Scrolls a field into view, focuses it and rings it briefly, so "Edit" from an audit lands on
 * the box to fill (audit #146, #176). Waits a frame or two for a panel or tab that is still
 * opening; gives up quietly when nothing matches.
 */
export function focusAndFlash(find: () => HTMLElement | null, tries = 10): void {
  const el = find()
  if (!el) {
    if (tries > 0) window.setTimeout(() => focusAndFlash(find, tries - 1), 60)
    return
  }
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  el.focus({ preventScroll: true })
  el.classList.add(...FLASH)
  window.setTimeout(() => el.classList.remove(...FLASH), FLASH_MS)
}
