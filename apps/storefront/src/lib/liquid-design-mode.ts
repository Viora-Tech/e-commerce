/**
 * Shopify's theme editor events on a storefront page Customize frames with an imported theme's
 * scripts running (`?theme-design-mode=1`, `components/theme/liquid-design-mode.tsx`). The editor
 * sends the page's sections as it has them; this works out what changed and what Shopify would
 * fire for it, so the theme's own scripts (sliders, tabs, accordions) re-initialise the way they
 * do in Shopify's editor:
 *
 * - `shopify:section:unload` on a section before it is replaced or removed,
 * - `shopify:section:load` once its new HTML is in and its inline scripts ran,
 * - `shopify:section:reorder` on a section that moved,
 * - `shopify:section:select` / `:deselect`, `shopify:block:select` / `:deselect` as the editor's
 *   selection moves.
 *
 * All bubble and carry `detail.sectionId` (`section.id` in Liquid), and `blockId` for blocks.
 * The planning half is plain data; the DOM half only runs in the browser.
 */
import type {
  DesignModeSection,
  DesignModeSelection,
  DesignModeState,
} from '@commerce/core/theme-design-mode'

/** What the page was last told, per section: its placement as JSON. */
export type KnownSections = ReadonlyMap<string, string>

export type DesignPlan = {
  /** Sections to (re)render: new ones and ones whose settings or blocks changed. */
  render: DesignModeSection[]
  /** Sections no longer on the page. */
  remove: string[]
  /** The selection changed: deselect the old one, select the new one. */
  deselect: DesignModeSelection
  select: DesignModeSelection
  /** The page's sections as they will be known after this update. */
  known: Map<string, string>
}

const sameSelection = (a: DesignModeSelection, b: DesignModeSelection) =>
  a?.sectionId === b?.sectionId && a?.blockId === b?.blockId

/**
 * The work one `state` message asks for. On the first one (`known` empty) every section renders:
 * the page loaded the saved theme, the editor may hold unsaved changes.
 */
export function planDesignUpdate(
  known: KnownSections,
  selected: DesignModeSelection,
  next: Pick<DesignModeState, 'zones' | 'selected'>,
): DesignPlan {
  const after = new Map<string, string>()
  const render: DesignModeSection[] = []
  for (const sections of Object.values(next.zones)) {
    for (const s of sections) {
      const json = JSON.stringify(s.placement)
      after.set(s.id, json)
      if (known.get(s.id) !== json) render.push(s)
    }
  }
  const remove = [...known.keys()].filter((id) => !after.has(id))
  const changed = !sameSelection(selected, next.selected)
  return {
    render,
    remove,
    deselect: changed ? selected : null,
    select: changed ? next.selected : null,
    known: after,
  }
}

/** Shopify's wrapper id for a section (`render.ts` `sectionWrapper`). */
export const sectionElementId = (sectionId: string) => `shopify-section-${sectionId}`

const WRAPPER_PREFIX = 'shopify-section-'

/** The section (and block) a click inside the page landed on, or null outside every section. */
export function clickTarget(
  target: Element | null,
): { sectionId: string; blockId: string | null } | null {
  const section = target?.closest<HTMLElement>(`[id^="${WRAPPER_PREFIX}"]`)
  if (!section) return null
  const block = target?.closest<HTMLElement>('[data-block-id]')
  return {
    sectionId: section.id.slice(WRAPPER_PREFIX.length),
    blockId: block && section.contains(block) ? block.getAttribute('data-block-id') : null,
  }
}

/** Fires one of Shopify's editor events on `el`, bubbling, as Shopify's editor does. */
export function fire(el: Element, name: string, detail: Record<string, unknown>): void {
  el.dispatchEvent(new CustomEvent(`shopify:${name}`, { bubbles: true, detail }))
}

/** Script types a browser runs; anything else (JSON, templates, parked scripts) stays inert. */
const RUNNABLE = /^(|text\/javascript|application\/javascript|module)$/i

/**
 * Inline and new external scripts in freshly inserted section HTML, run once: markup put in with
 * `innerHTML` never runs its scripts, so each is replaced by a live copy with the page's nonce.
 * An external file the page already loaded is not loaded twice (Shopify does not either); the
 * theme's custom elements re-initialise when they are connected.
 */
export function runSectionScripts(root: Element, nonce: string): void {
  const doc = root.ownerDocument
  for (const old of root.querySelectorAll('script')) {
    if (!RUNNABLE.test(old.type.trim())) continue
    if (old.src && [...doc.scripts].some((s) => s !== old && s.src === old.src)) continue
    const live = doc.createElement('script')
    for (const attr of old.attributes) live.setAttribute(attr.name, attr.value)
    if (nonce) live.nonce = nonce
    live.textContent = old.textContent
    old.replaceWith(live)
  }
}

/** The page's CSP nonce, read from a script that already ran with it. */
export function pageNonce(doc: Document): string {
  for (const s of doc.scripts) if (s.nonce) return s.nonce
  return ''
}

/**
 * Puts a section's new HTML on the page: in place of its old wrapper (unload first), else after
 * the closest earlier section of its group that is on the page, else before the next one, else at
 * the end of the main content. Fires `section:load` once its scripts ran.
 */
export function placeSection(
  doc: Document,
  section: DesignModeSection,
  html: string,
  neighbours: readonly string[],
): void {
  const holder = doc.createElement('template')
  holder.innerHTML = html
  const fresh = holder.content.firstElementChild
  if (!fresh) return
  const old = doc.getElementById(sectionElementId(section.id))
  if (old) {
    fire(old, 'section:unload', { sectionId: section.id })
    old.replaceWith(fresh)
  } else {
    const at = neighbours.indexOf(section.id)
    const before = neighbours
      .slice(0, at)
      .reverse()
      .map((id) => doc.getElementById(sectionElementId(id)))
      .find(Boolean)
    const after = neighbours
      .slice(at + 1)
      .map((id) => doc.getElementById(sectionElementId(id)))
      .find(Boolean)
    if (before) before.after(fresh)
    else if (after) after.before(fresh)
    else doc.getElementById('MainContent')?.append(fresh)
  }
  runSectionScripts(fresh, pageNonce(doc))
  fire(fresh, 'section:load', { sectionId: section.id })
}

/** Moves a group's sections into the editor's order, firing `section:reorder` on each one moved. */
export function reorderSections(doc: Document, order: readonly string[]): void {
  let previous: Element | null = null
  for (const id of order) {
    const el = doc.getElementById(sectionElementId(id))
    if (!el) continue
    if (
      previous &&
      el.previousElementSibling !== previous &&
      previous.parentNode === el.parentNode
    ) {
      previous.after(el)
      fire(el, 'section:reorder', { sectionId: id })
    }
    previous = el
  }
}

/** Removes a section the editor no longer has, after `section:unload`. */
export function removeSection(doc: Document, sectionId: string): void {
  const el = doc.getElementById(sectionElementId(sectionId))
  if (!el) return
  fire(el, 'section:unload', { sectionId })
  el.remove()
}

/** Fires the select or deselect events for one selection, scrolling a selected section into view. */
export function selectionEvents(doc: Document, sel: DesignModeSelection, on: boolean): void {
  if (!sel) return
  const section = doc.getElementById(sectionElementId(sel.sectionId))
  if (!section) return
  fire(section, on ? 'section:select' : 'section:deselect', {
    sectionId: sel.sectionId,
    load: false,
  })
  if (on) section.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  if (!sel.blockId) return
  const block = section.querySelector(`[data-block-id="${CSS.escape(sel.blockId)}"]`)
  if (block) {
    fire(block, on ? 'block:select' : 'block:deselect', {
      sectionId: sel.sectionId,
      blockId: sel.blockId,
      load: false,
    })
  }
}
