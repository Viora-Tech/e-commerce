/**
 * How the Customize canvas answers the pointer. Puck's iframe styles make every section a drag
 * source: a grab cursor over all of it and `pointer-events: none` on everything inside, so
 * nothing in a section could be clicked, and pressing anywhere and moving 5px picked the whole
 * section up. Here the canvas behaves like the page instead:
 *
 * - the cursor is the page's own arrow; Puck's inline text keeps its text cursor, and a drag
 *   across it selects words;
 * - the selected section's controls (carousel arrows and dots, tabs, accordions, toggles) work;
 * - a section moves only from the grip on its toolbar (`forwardSectionDrag`), never from a
 *   press on its content, so selecting text or pressing a control never drags it;
 * - links and forms never take the canvas away from the editor;
 * - a click that lands on something that is not a section (an imported theme's invisible
 *   full-page layer: a cart-drawer backdrop, a page loader, a menu overlay), or on a section's
 *   own see-through layer (a closed popup's backdrop), goes to the section under the pointer
 *   instead, so such a layer can never make sections unselectable (`sectionUnder`). The first
 *   time it happens, the console names the layer.
 *
 * Plain DOM logic with no JSX, so it sits outside the component-structure rule.
 */

/**
 * The controls of a selected section that stay usable while editing. Puck's sections are
 * themselves `role="button"` drag sources, so those never count.
 */
const CONTROLS = [
  'button',
  'summary',
  'details',
  'label',
  'select',
  'input',
  'textarea',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="slider"]',
  '[role="option"]',
]
  .map((control) => `${control}:not([data-puck-component], [aria-roledescription="draggable"])`)
  .join(', ')

/** Puck's own chrome inside the canvas (inline text, the block toolbar, the "+" line). */
const OVERLAY_PORTAL = '[data-puck-overlay-portal]'

/**
 * The page's arrow over sections instead of Puck's grab hand, which said "drag me" everywhere.
 * Scoped under `[data-puck-entry]` so it outranks Puck's own rule.
 */
export const CANVAS_INTERACTION_CSS = `
  [data-puck-entry] [data-puck-component] { cursor: default; }
`

/** Makes the selected section's controls usable: Puck turns pointer events off inside it. */
export function selectedControlsCss(id: string | null): string {
  if (!id) return ''
  const scope = `[data-puck-entry][data-puck-preview-mode="edit"] [data-puck-component="${CSS.escape(id)}"]`
  return `${scope} :is(${CONTROLS}) { pointer-events: auto; cursor: pointer; }`
}

/** Clicks the canvas re-sends to the section under an overlay (`sectionUnder`). */
const rerouted = new WeakSet<Event>()

/** Layers already reported in the console, so a stuck overlay is named once, not per click. */
const reported = new WeakSet<Element>()

/** "div.drawer__overlay#CartDrawer-Overlay": enough to find the element in the theme's code. */
function describe(el: Element): string {
  const id = el.id ? `#${el.id}` : ''
  const classes = [...el.classList]
    .slice(0, 3)
    .map((c) => `.${c}`)
    .join('')
  return `${el.tagName.toLowerCase()}${classes}${id}`
}

/**
 * Whether the element shows nothing: it or a parent up to its section is fully transparent. A
 * closed popup's backdrop (opacity 0, still catching clicks) is such a layer, because design
 * mode un-hides popups and the theme's script that would close them never runs in the canvas.
 */
function invisible(el: Element, section: Element): boolean {
  const view = el.ownerDocument.defaultView
  if (!view) return false
  for (let node: Element | null = el; node && node !== section; node = node.parentElement) {
    const style = view.getComputedStyle(node)
    if (style.opacity === '0' || style.visibility === 'hidden') return true
  }
  return false
}

/**
 * The section under the pointer when the click landed outside every section, or on an
 * invisible layer of one (`invisible`): the topmost element at that point that sits visibly
 * inside a section. Null when the press really was outside them (the page's empty margin), on
 * Puck's own chrome, or on something the section shows.
 */
function sectionUnder(doc: Document, e: MouseEvent): Element | null {
  const target = e.target as Element
  if (target.closest(OVERLAY_PORTAL)) return null
  const own = target.closest('[data-puck-component]')
  if (own && !invisible(target, own)) return null
  for (const el of doc.elementsFromPoint(e.clientX, e.clientY)) {
    const section = el.closest('[data-puck-component]')
    if (section && section !== own && !invisible(el, section)) return section
  }
  return null
}

/** Pointer events the canvas sends on to a section on purpose (`forwardSectionDrag`). */
const forwarded = new WeakSet<Event>()

/**
 * Picks a section up from its toolbar grip. The toolbar lives outside the section's element
 * (Puck portals it), so the press is handed to the section as its own `pointerdown`; Puck's
 * drag sensor then follows the real pointer from there, and the drag starts once it moves.
 */
export function forwardSectionDrag(event: PointerEvent, componentId: string): void {
  const doc = (event.target as Node | null)?.ownerDocument
  const view = doc?.defaultView
  const section = doc?.querySelector(`[data-puck-component="${CSS.escape(componentId)}"]`)
  if (!view || !section || event.button !== 0) return
  const copy = new view.PointerEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    isPrimary: event.isPrimary,
    button: 0,
    buttons: event.buttons,
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
  })
  forwarded.add(copy)
  section.dispatchEvent(copy)
}

/** Whether a press inside the canvas may reach Puck's drag sensor. */
function mayDrag(target: Element, selectedId: string | null): boolean {
  if (!target.closest('[data-puck-component]')) return true
  // Inline text: a press there places the caret and a drag selects words.
  if (target.closest('[contenteditable]')) return false
  if (target.closest(OVERLAY_PORTAL)) return true
  // A control in the selected section handles its own press (a carousel's swipe, a slider).
  const selected = selectedId
    ? target.closest(`[data-puck-component="${CSS.escape(selectedId)}"]`)
    : null
  const control = target.closest(CONTROLS)
  return selected !== null && control !== null && selected.contains(control)
}

/**
 * Installs the canvas's pointer rules on the preview frame's document; returns the cleanup.
 * `selectedId` is read on each press, so selection changes need no re-install.
 */
export function installCanvasInteraction(
  doc: Document,
  selectedId: () => string | null,
): () => void {
  const view = doc.defaultView
  if (!view) return () => {}
  // Capture on the window runs before the section's own listeners, Puck's drag sensor among
  // them. Clicks still arrive, so selecting a section and inline editing work as before.
  const handlePointerDown = (e: PointerEvent) => {
    if (forwarded.has(e) || !(e.target instanceof view.Element)) return
    if (!mayDrag(e.target, selectedId())) e.stopPropagation()
  }
  // A link would load the address inside the canvas, and a form would post from the editor.
  // A click caught by a theme's overlay is handed to the section beneath it.
  const handleClick = (e: MouseEvent) => {
    if (!(e.target instanceof view.Element)) return
    if (e.target.closest('a[href]')) e.preventDefault()
    if (rerouted.has(e)) return
    const section = sectionUnder(doc, e)
    if (!section) return
    if (!reported.has(e.target)) {
      reported.add(e.target)
      console.info(
        `[customize] a click landed on ${describe(e.target)}, an invisible layer or one outside every section; sent it to the section underneath`,
      )
    }
    e.preventDefault()
    e.stopPropagation()
    const copy = new view.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: e.clientX,
      clientY: e.clientY,
      screenX: e.screenX,
      screenY: e.screenY,
      button: e.button,
      buttons: e.buttons,
    })
    rerouted.add(copy)
    section.dispatchEvent(copy)
  }
  const handleSubmit = (e: SubmitEvent) => e.preventDefault()
  view.addEventListener('pointerdown', handlePointerDown, true)
  view.addEventListener('click', handleClick, true)
  view.addEventListener('submit', handleSubmit, true)
  return () => {
    view.removeEventListener('pointerdown', handlePointerDown, true)
    view.removeEventListener('click', handleClick, true)
    view.removeEventListener('submit', handleSubmit, true)
  }
}
