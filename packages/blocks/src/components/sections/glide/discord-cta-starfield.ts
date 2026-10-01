type Star = { x: number; y: number; z: number; v: number; b: boolean }

const STAR_COUNT = 110
const FALLBACK_BRAND = 'currentColor'

function makeStars(): Star[] {
  return Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: Math.random() * 0.8 + 0.2,
    v: Math.random() * 0.00022 + 0.00005,
    b: Math.random() < 0.22,
  }))
}

/**
 * Port of assets/discord-stars.js. Draws rising stars on `canvas` (a few in the brand colour,
 * leaning away from the pointer) while the band is on screen and the tab is visible; with
 * reduced motion the stars are drawn once and stay still. Returns the teardown.
 */
export function startStarfield(canvas: HTMLCanvasElement): () => void {
  const band = canvas.parentElement
  const win = canvas.ownerDocument.defaultView
  const ctx = canvas.getContext('2d')
  if (!band || !win || !ctx) return () => {}

  const reduce = win.matchMedia('(prefers-reduced-motion: reduce)')
  const style = win.getComputedStyle(band)
  const brand = style.getPropertyValue('--color-brand').trim() || FALLBACK_BRAND
  const ink = style.getPropertyValue('--discord-ink').trim() || style.color
  const stars = makeStars()
  let mx = 0
  let my = 0
  let running = false
  let raf = 0

  const size = () => {
    const r = canvas.getBoundingClientRect()
    const d = win.devicePixelRatio || 1
    canvas.width = Math.max(1, r.width * d)
    canvas.height = Math.max(1, r.height * d)
    ctx.setTransform(d, 0, 0, d, 0, 0)
  }

  const draw = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.clearRect(0, 0, w, h)
    for (const s of stars) {
      if (!reduce.matches) {
        s.y -= s.v * s.z * 6
        if (s.y < 0) {
          s.y = 1
          s.x = Math.random()
        }
      }
      ctx.globalAlpha = s.b ? s.z : s.z * 0.75
      ctx.fillStyle = s.b ? brand : ink
      ctx.beginPath()
      ctx.arc((s.x - mx * 0.05 * s.z) * w, (s.y - my * 0.05 * s.z) * h, s.z * 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    if (running && !reduce.matches) raf = win.requestAnimationFrame(draw)
  }

  const start = () => {
    if (running) return
    running = true
    size()
    raf = win.requestAnimationFrame(draw)
  }
  const stop = () => {
    running = false
    win.cancelAnimationFrame(raf)
  }

  const handlePointer = (e: PointerEvent) => {
    const b = band.getBoundingClientRect()
    mx = (e.clientX - b.left) / b.width - 0.5
    my = (e.clientY - b.top) / b.height - 0.5
  }
  const handleResize = () => {
    size()
    if (!running) draw()
  }
  const handleVisibility = () => {
    if (canvas.ownerDocument.hidden) stop()
  }

  band.addEventListener('pointermove', handlePointer)
  win.addEventListener('resize', handleResize)
  canvas.ownerDocument.addEventListener('visibilitychange', handleVisibility)
  const observer =
    'IntersectionObserver' in win
      ? new win.IntersectionObserver((entries) => {
          if (entries[0]?.isIntersecting) start()
          else stop()
        })
      : null
  if (observer) observer.observe(band)
  else start()
  size()
  draw()

  return () => {
    stop()
    observer?.disconnect()
    band.removeEventListener('pointermove', handlePointer)
    win.removeEventListener('resize', handleResize)
    canvas.ownerDocument.removeEventListener('visibilitychange', handleVisibility)
  }
}
