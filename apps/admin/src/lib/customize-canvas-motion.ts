import type { PuckAction } from '@puckeditor/core'

/**
 * Canvas motion for Customize's preview iframe. Puck 0.23 ships almost no
 * canvas animation of its own (traced through the built package: the
 * DraggableComponent wrapper's `transition-duration` computes to `0s`, and
 * reordering during a drag is a real, instant DOM reorder inside the
 * DropZone — not a transform trick). Confirmed the same is true of Puck
 * Cloud's own onboarding editor (same package, same `0s`), so this is genuinely
 * built here, not "turned on" from an existing feature.
 *
 * This file is plain DOM/CSS logic (no JSX), so it sits outside the
 * component-structure rule in docs/conventions.md, which only applies to
 * `.tsx` files.
 */

// Subtle and quick (150 to 200 ms), easing out, never overshooting: the canvas
// should feel responsive, not animated.
const DURATION_MOVE = 200
const DURATION_ENTER = 200
const DURATION_OUTLINE = 150
const EASE = 'ease-out'
// --puck-color-interactive lives in vendor-puck.css, the admin document's own
// stylesheet, which never reaches this iframe (see this file's own doc comment)
// — so this reads --admin-accent instead, the value PreviewFrame writes onto
// the iframe root from the admin's own computed --primary (customize-doc's
// storefront theme redefines --primary inside here, so the plain token name
// can't be trusted). #4ea674 only applies before that first write.
const RING_COLOR = 'var(--admin-accent, #4ea674)'

/** Injected into the iframe's `<head>` — vendor-puck.css and the admin's own stylesheets never reach it. */
export function canvasMotionCss(reducedMotion: boolean): string {
  if (reducedMotion) {
    return `
      [data-puck-component], [data-puck-line-placeholder] { transition: none !important; animation: none !important; }
    `
  }
  return `
    [data-puck-component] {
      transition: translate ${DURATION_MOVE}ms ${EASE}, opacity ${DURATION_ENTER}ms ${EASE};
    }
    /* Named here so installCanvasMotion can apply it by name; it targets only a section
       it has confirmed is a genuine new insert, never the ones already on screen at load. */
    @keyframes puck-insert-ring {
      0% { box-shadow: 0 0 0 3px ${RING_COLOR}; }
      100% { box-shadow: 0 0 0 0 transparent; }
    }
    /* The dragged item itself: Puck drives its own translate every frame, so ours is
       excluded there, but the lift (scale + shadow) is ours and still eases in. */
    [data-puck-component][data-dnd-dragging='true'] {
      transition: scale 150ms ${EASE}, box-shadow 150ms ${EASE};
      animation: none;
      scale: 1.02;
      box-shadow: 0 1.25rem 2.5rem -0.75rem rgb(0 0 0 / 0.35);
    }
    @starting-style {
      [data-puck-component] {
        opacity: 0;
        translate: 0 1rem;
      }
    }
    [data-puck-line-placeholder] {
      transition: transform 200ms ${EASE}, opacity 200ms ${EASE};
    }
    /* Puck mounts a section's hover/selection outline instantly; fade it in instead. */
    @keyframes puck-outline-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    [data-puck-overlay] {
      animation: puck-outline-in ${DURATION_OUTLINE}ms ${EASE};
    }
    @starting-style {
      [data-puck-line-placeholder] {
        opacity: 0;
        transform: scaleX(0.3);
      }
    }
  `
}

const components = (doc: Document) =>
  [...doc.querySelectorAll('[data-puck-component]')] as HTMLElement[]
const idOf = (el: HTMLElement) => el.getAttribute('data-puck-component') ?? ''

/**
 * FLIP for the siblings a drag pushes aside. Puck reorders `[data-puck-component]`
 * nodes live inside their `[data-puck-dropzone]` as the pointer moves — a real
 * DOM move, which a CSS transition alone can't animate. This samples every
 * frame while a drag is active, and on any node whose position jumped between
 * frames, plays it in from its previous spot instead of letting it snap.
 */
function installDragFlip(doc: Document, view: Window): () => void {
  let frame = 0
  let rects = new Map<string, DOMRect>()

  const seed = () => {
    rects = new Map(components(doc).map((el) => [idOf(el), el.getBoundingClientRect()]))
  }

  const flip = () => {
    for (const el of components(doc)) {
      const id = idOf(el)
      const isDragged = el.getAttribute('data-dnd-dragging') === 'true'
      const next = el.getBoundingClientRect()
      const prev = rects.get(id)
      if (!isDragged && prev) {
        const dx = prev.left - next.left
        const dy = prev.top - next.top
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          el.style.transition = 'none'
          el.style.translate = `${dx}px ${dy}px`
          void el.offsetHeight // force reflow before re-enabling the transition
          el.style.transition = `translate ${DURATION_MOVE}ms ${EASE}`
          el.style.translate = '0 0'
        }
      }
      rects.set(id, next)
    }
  }

  // Samples only while a drag is on: a loop running every frame for the editor's whole life kept
  // the canvas producing frames even when nothing moved.
  const tick = () => {
    flip()
    frame = view.requestAnimationFrame(tick)
  }
  const sync = () => {
    const dragging = doc.querySelector('[data-puck-entry]')?.getAttribute('data-puck-dragging')
    if (dragging === 'true' && !frame) {
      seed()
      frame = view.requestAnimationFrame(tick)
    } else if (dragging !== 'true' && frame) {
      view.cancelAnimationFrame(frame)
      frame = 0
    }
  }
  const observer = new MutationObserver(sync)
  observer.observe(doc.body, {
    attributes: true,
    attributeFilter: ['data-puck-dragging'],
    subtree: true,
  })
  sync()

  return () => {
    observer.disconnect()
    view.cancelAnimationFrame(frame)
  }
}

/**
 * The accent ring on a genuinely new section. A blanket CSS `animation` would
 * also replay on every template switch (a fresh iframe remounts every section
 * at once), so this tracks which ids have already been seen and only rings
 * the ones that weren't — seeded once at mount before anything can flash.
 */
function installInsertRing(doc: Document): () => void {
  let known = new Set(components(doc).map(idOf))

  const ring = (el: HTMLElement) => {
    el.style.animation = 'puck-insert-ring 200ms ease-out'
    const clear = () => {
      el.style.animation = ''
      el.removeEventListener('animationend', clear)
    }
    el.addEventListener('animationend', clear)
  }

  const observer = new MutationObserver((records) => {
    // Typing and the sections' own DOM updates mutate the canvas all the time; only an added
    // element can be a new section.
    if (!records.some((r) => [...r.addedNodes].some((n) => n.nodeType === Node.ELEMENT_NODE)))
      return
    const next = new Set(components(doc).map(idOf))
    for (const el of components(doc)) {
      if (!known.has(idOf(el))) ring(el)
    }
    known = next
  })
  const entry = doc.querySelector('[data-puck-entry]')
  if (entry) observer.observe(entry, { childList: true, subtree: true })

  return () => observer.disconnect()
}

/** Set on a section while it is out of the canvas's view (with a margin). */
const OFFSCREEN = 'data-canvas-offscreen'

/** Room above and below the canvas in which a section counts as in view. */
const OFFSCREEN_MARGIN = '200px 0px'

/** Pauses the CSS animations of every section marked by `installOffscreenPause`. */
export const OFFSCREEN_PAUSE_CSS = `[${OFFSCREEN}], [${OFFSCREEN}] *, [${OFFSCREEN}]::before, [${OFFSCREEN}]::after, [${OFFSCREEN}] *::before, [${OFFSCREEN}] *::after { animation-play-state: paused !important; }`

/**
 * Pauses the animations of sections scrolled out of the canvas. A marquee, an orbit or a
 * shimmer keeps the page producing frames, and every frame re-layers the whole page: on a
 * long home page that was a third of a CPU core with the editor sitting idle. Sections in
 * view keep moving, so the canvas still looks like the store. CSS animations pause through
 * `OFFSCREEN_PAUSE_CSS`; script-driven Web Animations are paused and resumed here.
 */
export function installOffscreenPause(doc: Document): () => void {
  const view = doc.defaultView
  if (!view) return () => {}
  const scripted = (el: Element) =>
    el
      .getAnimations({ subtree: true })
      .filter((a) => !(a instanceof view.CSSAnimation) && !(a instanceof view.CSSTransition))
  const observer = new view.IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const away = !entry.isIntersecting
        if (entry.target.hasAttribute(OFFSCREEN) === away) continue
        entry.target.toggleAttribute(OFFSCREEN, away)
        for (const animation of scripted(entry.target)) {
          if (away && animation.playState === 'running') animation.pause()
          else if (!away && animation.playState === 'paused') animation.play()
        }
      }
    },
    { rootMargin: OFFSCREEN_MARGIN },
  )
  const watched = new WeakSet<Element>()
  const watch = () => {
    for (const el of components(doc)) {
      if (watched.has(el)) continue
      watched.add(el)
      observer.observe(el)
    }
  }
  // Sections come and go as the page is edited; look for new ones at most once a frame.
  let frame = 0
  const mutations = new MutationObserver((records) => {
    if (frame || !records.some((r) => r.addedNodes.length > 0)) return
    frame = view.requestAnimationFrame(() => {
      frame = 0
      watch()
    })
  })
  mutations.observe(doc.body, { childList: true, subtree: true })
  watch()
  return () => {
    mutations.disconnect()
    observer.disconnect()
    view.cancelAnimationFrame(frame)
    for (const el of components(doc)) el.removeAttribute(OFFSCREEN)
  }
}

/** Returns a cleanup function; installs nothing under reduced motion. */
export function installCanvasMotion(doc: Document, reducedMotion: boolean): () => void {
  const view = doc.defaultView
  if (reducedMotion || !view) return () => {}
  const uninstallFlip = installDragFlip(doc, view)
  const uninstallRing = installInsertRing(doc)
  return () => {
    uninstallFlip()
    uninstallRing()
  }
}

/** A section leaving the canvas: fade and collapse before the remove actually dispatches. */
function collapseSection(el: HTMLElement, reducedMotion: boolean): Promise<void> {
  if (reducedMotion) return Promise.resolve()
  const height = el.offsetHeight
  el.style.overflow = 'hidden'
  const animation = el.animate(
    [
      { opacity: 1, maxHeight: `${height}px` },
      { opacity: 0, maxHeight: '0px' },
    ],
    { duration: 200, easing: 'ease-in' },
  )
  return animation.finished.catch(() => undefined).then(() => undefined)
}

export type DeleteTarget = { index: number; zone: string }

/**
 * The one path every "delete a section" trigger goes through — the canvas
 * overlay's trash button, the Sections tree row's trash button, and the
 * Delete/Backspace hotkey. Each finds its own DOM node to collapse (the
 * canvas and the tree row live in different documents, so there's no single
 * universal lookup), then all three call this to play the same collapse and
 * dispatch `remove` only once it finishes, so undo still lands on a single,
 * ordinary history entry.
 */
export function deleteWithCollapse(
  dispatch: (action: PuckAction) => void,
  target: DeleteTarget,
  el: HTMLElement | null,
  reducedMotion: boolean,
): void {
  const commit = () => dispatch({ type: 'remove', index: target.index, zone: target.zone })
  if (!el) {
    commit()
    return
  }
  collapseSection(el, reducedMotion).then(commit)
}

/** How many frames `scrollToSection` waits for a just-inserted section to reach the iframe. */
const MAX_WAIT_FRAMES = 60

/**
 * Brings a section into view in the preview iframe, e.g. after it's picked in
 * the Sections tree (Puck only scrolls for selections made on the canvas), or
 * right after it was added.
 */
export function scrollToSection(id: string, reducedMotion: boolean): void {
  // Selecting a row also dispatches Puck's own `setUi`, which re-renders the
  // canvas's selection chrome (BlockToolbar) a tick later — scrolling in
  // the same call stack raced that re-render and was silently un-done before
  // it ever painted. Waiting a frame lets that settle first. A section that
  // was only just inserted may take a few more frames to render inside the
  // iframe, so keep looking (up to about a second) until it's there.
  let frames = 0
  const attempt = () => {
    const frame = document.querySelector<HTMLIFrameElement>('#main iframe')
    const el = frame?.contentDocument?.querySelector<HTMLElement>(`[data-puck-component="${id}"]`)
    if (el) {
      el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
      return
    }
    frames += 1
    if (frames < MAX_WAIT_FRAMES) requestAnimationFrame(attempt)
  }
  requestAnimationFrame(attempt)
}

/** The OS "reduce motion" setting, for callers outside React (Puck's `onAction`). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
