import { type RefObject, useEffect, useRef, useState } from 'react'

type HeroAutoplay = {
  /** The interval has started at least once (the active dot's fill may run). */
  running: boolean
  /** Hovered, pressed, off screen or in a hidden tab: the dot fill freezes where it is. */
  paused: boolean
  /** Bumps whenever the interval (re)starts, so the dot fill can restart in lockstep. */
  run: number
  /** Any navigation restarts the clock, so a chosen slide gets a full interval. */
  restart: () => void
}

/**
 * The autoplay clock of Glide's hero-carousel.js: one interval, paused on hover, pointer
 * down, a hidden tab or the hero leaving the screen, and resumed with whatever was left of
 * the current slide's time (hover behaves like pausing a video). `onTick` advances a slide.
 */
export function useHeroAutoplay(
  root: RefObject<HTMLElement | null>,
  enabled: boolean,
  intervalMs: number,
  onTick: () => void,
): HeroAutoplay {
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [run, setRun] = useState(0)
  const tick = useRef(onTick)
  const restartRef = useRef<() => void>(() => {})
  useEffect(() => {
    tick.current = onTick
  })
  useEffect(() => {
    const el = root.current
    if (!enabled || !el) return
    let timer = 0
    let resumeTimer = 0
    let startedAt = 0
    let remaining: number | null = null
    const stop = () => {
      window.clearInterval(timer)
      window.clearTimeout(resumeTimer)
      timer = 0
      resumeTimer = 0
    }
    const start = () => {
      stop()
      remaining = null
      startedAt = Date.now()
      timer = window.setInterval(() => {
        startedAt = Date.now()
        tick.current()
        setRun((r) => r + 1)
      }, intervalMs)
      setRunning(true)
      setRun((r) => r + 1)
    }
    const pause = () => {
      if (timer || resumeTimer) remaining = Math.max(0, intervalMs - (Date.now() - startedAt))
      stop()
      setPaused(true)
    }
    const resume = () => {
      setPaused(false)
      if (remaining === null) return start()
      const left = remaining
      remaining = null
      resumeTimer = window.setTimeout(() => {
        resumeTimer = 0
        start()
        tick.current()
      }, left)
    }
    restartRef.current = () => {
      if (timer || resumeTimer) start()
    }
    const onVisibility = () => {
      if (document.hidden) pause()
      else resume()
    }
    const seen = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) resume()
        else pause()
      }
    })
    seen.observe(el)
    el.addEventListener('mouseenter', pause)
    el.addEventListener('mouseleave', resume)
    el.addEventListener('pointerdown', pause)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      restartRef.current = () => {}
      seen.disconnect()
      el.removeEventListener('mouseenter', pause)
      el.removeEventListener('mouseleave', resume)
      el.removeEventListener('pointerdown', pause)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [root, enabled, intervalMs])

  return { running: enabled && running, paused, run, restart: () => restartRef.current() }
}
