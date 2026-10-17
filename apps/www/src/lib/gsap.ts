/**
 * GSAP, loaded on demand. The core plus ScrollTrigger and SplitText are pulled in with dynamic
 * imports the first time a section needs them, so none of it is in the first-load bundle.
 */
export type GsapKit = {
  gsap: typeof import('gsap').gsap
  ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger
  SplitText: typeof import('gsap/SplitText').SplitText
}

let kit: Promise<GsapKit> | null = null

export function loadGsap(): Promise<GsapKit> {
  kit ??= Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger'),
    import('gsap/SplitText'),
  ]).then(([core, scroll, split]) => {
    core.gsap.registerPlugin(scroll.ScrollTrigger, split.SplitText)
    return { gsap: core.gsap, ScrollTrigger: scroll.ScrollTrigger, SplitText: split.SplitText }
  })
  return kit
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** True on touch-first devices, where hover effects (spotlight, tilt, magnet) are skipped. */
export function isCoarsePointer(): boolean {
  return window.matchMedia('(hover: none), (pointer: coarse)').matches
}
