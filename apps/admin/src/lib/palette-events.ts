/**
 * The command palette lives once in the admin frame (PaletteHost); anything that wants to
 * open it (the sidebar Search row, the phone bar's search button) fires this event.
 * Browser only.
 */
export const OPEN_PALETTE_EVENT = 'admin:open-palette'

export function openPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))
}

/** True while the user is typing somewhere, so single-key shortcuts ("/") stay out of the way. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}
