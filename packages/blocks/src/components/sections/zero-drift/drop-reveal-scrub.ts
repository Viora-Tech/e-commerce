import { DROP_REVEAL } from '../../../data/zero-drift/drop-reveal'

type Mode = 'scrub' | 'static'

/**
 * Layout offset of `el` inside `root`, walking the offsetParent chain. offsetLeft/offsetTop
 * ignore transforms, so this is where an element sits at rest even mid-scrub.
 */
function offsetWithin(el: HTMLElement, root: HTMLElement) {
  let x = 0
  let y = 0
  let node: HTMLElement | null = el
  while (node && node !== root) {
    x += node.offsetLeft
    y += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return { x, y }
}

/**
 * Port of assets/drop-reveal.js (<drop-reveal>). The markup already renders the final frame;
 * this only adds the pinned scroll timeline (one `--p` custom property on the host per frame,
 * every layer's transform derives from it in CSS) on wide screens without reduced motion, and a
 * one-shot entry fade otherwise. Returns the teardown.
 */
export function startDropReveal(host: HTMLElement): () => void {
  const win = host.ownerDocument.defaultView
  const track = host.querySelector<HTMLElement>('[data-drop-track]')
  const stage = host.querySelector<HTMLElement>('[data-drop-stage]')
  const scene = host.querySelector<HTMLElement>('[data-drop-scene]')
  const card = host.querySelector<HTMLElement>('[data-drop-card]')
  const items = Array.from(host.querySelectorAll<HTMLElement>('[data-drop-item]'))
  if (!win || !track || !stage || !scene || !card || !items.length) return () => {}

  const desktop = win.matchMedia(DROP_REVEAL.desktopQuery)
  const reduced = win.matchMedia(DROP_REVEAL.reducedQuery)
  let mode: Mode | null = null
  let progress = -1
  let span = 0
  let raf = 0
  let resizeTimer = 0
  let observer: IntersectionObserver | null = null
  let active = false

  // Measures what CSS cannot: each product's pixel offset from the inside of the box, and the
  // scroll distance the pin spans. Layout reads, so mount and debounced resize only.
  const measure = () => {
    span = track.offsetHeight - stage.offsetHeight
    const cardOffset = offsetWithin(card, scene)
    const slotX = cardOffset.x
    const slotY = cardOffset.y + card.offsetHeight * DROP_REVEAL.slotFactor
    for (const item of items) {
      const at = offsetWithin(item, scene)
      item.style.setProperty('--dx', `${(slotX - (at.x + item.offsetWidth / 2)).toFixed(1)}px`)
      item.style.setProperty('--dy', `${(slotY - (at.y + item.offsetHeight / 2)).toFixed(1)}px`)
    }
  }

  const write = () => host.style.setProperty('--p', progress.toFixed(4))

  const update = () => {
    if (span <= 0) return
    const target = Math.min(1, Math.max(0, -track.getBoundingClientRect().top / span))
    // The rendered progress eases toward the scroll position so notched wheel jumps read as
    // motion; the target is still exactly the scroll, so scrubbing backwards stays exact.
    if (progress < 0) progress = target
    const delta = target - progress
    if (Math.abs(delta) < DROP_REVEAL.idleDelta) {
      progress = target
      write()
      return
    }
    progress += delta * DROP_REVEAL.smoothing
    write()
    if (!raf) raf = win.requestAnimationFrame(handleFrame)
  }

  function handleFrame() {
    raf = 0
    update()
  }

  const handleScroll = () => {
    if (!raf) raf = win.requestAnimationFrame(handleFrame)
  }

  const setActive = (next: boolean) => {
    if (next === active) return
    active = next
    if (next) {
      host.setAttribute('data-active', '')
      win.addEventListener('scroll', handleScroll, { passive: true })
      handleScroll()
      return
    }
    host.removeAttribute('data-active')
    win.removeEventListener('scroll', handleScroll)
    if (raf) win.cancelAnimationFrame(raf)
    raf = 0
  }

  const teardown = () => {
    observer?.disconnect()
    observer = null
    win.removeEventListener('scroll', handleScroll)
    if (raf) win.cancelAnimationFrame(raf)
    raf = 0
    active = false
    host.removeAttribute('data-active')
  }

  const startScrub = () => {
    measure()
    update()
    if (!('IntersectionObserver' in win)) {
      setActive(true)
      return
    }
    observer = new win.IntersectionObserver(
      (entries) => {
        for (const entry of entries) setActive(entry.isIntersecting)
      },
      { rootMargin: DROP_REVEAL.activeMargin },
    )
    observer.observe(track)
  }

  const startStatic = () => {
    if (!('IntersectionObserver' in win)) return
    host.setAttribute('data-entry', '')
    observer = new win.IntersectionObserver(
      (entries, obs) => {
        if (!entries.some((e) => e.isIntersecting)) return
        host.classList.add('is-in')
        obs.disconnect()
        observer = null
      },
      { threshold: DROP_REVEAL.entryThreshold, rootMargin: DROP_REVEAL.entryMargin },
    )
    observer.observe(host)
  }

  // Re-picks scrub or static whenever the viewport crosses the breakpoint or the visitor
  // toggles reduced motion mid-session.
  const applyMode = () => {
    const next: Mode = desktop.matches && !reduced.matches ? 'scrub' : 'static'
    if (next === mode) return
    teardown()
    mode = next
    if (next === 'scrub') {
      host.removeAttribute('data-entry')
      host.classList.remove('is-in')
      host.setAttribute('data-mode', 'scrub')
      startScrub()
      return
    }
    host.removeAttribute('data-mode')
    host.style.removeProperty('--p')
    progress = -1
    for (const item of items) {
      item.style.removeProperty('--dx')
      item.style.removeProperty('--dy')
    }
    startStatic()
  }

  const handleResize = () => {
    win.clearTimeout(resizeTimer)
    resizeTimer = win.setTimeout(() => {
      if (mode !== 'scrub') return
      measure()
      progress = -1
      update()
    }, DROP_REVEAL.resizeDelayMs)
  }

  desktop.addEventListener('change', applyMode)
  reduced.addEventListener('change', applyMode)
  win.addEventListener('resize', handleResize)
  applyMode()

  return () => {
    teardown()
    desktop.removeEventListener('change', applyMode)
    reduced.removeEventListener('change', applyMode)
    win.removeEventListener('resize', handleResize)
    win.clearTimeout(resizeTimer)
    host.removeAttribute('data-mode')
    host.removeAttribute('data-entry')
    host.style.removeProperty('--p')
  }
}
