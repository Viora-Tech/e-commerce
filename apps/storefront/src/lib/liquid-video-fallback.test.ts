// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { COVER_FALLBACK_MS, VIDEO_FALLBACK_SCRIPT } from './liquid-video-fallback'

function run() {
  ;(window as unknown as { __commerceVideoFallback?: boolean }).__commerceVideoFallback = false
  new Function(VIDEO_FALLBACK_SCRIPT)()
}

function video(): HTMLVideoElement {
  document.body.innerHTML =
    '<video autoplay muted data-cover="/m/hero-poster.jpg"><source src="/m/hero.mp4"></video>'
  return document.querySelector('video') as HTMLVideoElement
}

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('hero video cover fallback', () => {
  it('shows the cover when the video file fails to load', () => {
    const v = video()
    run()
    expect(v.getAttribute('poster')).toBeNull()
    v.querySelector('source')?.dispatchEvent(new Event('error'))
    expect(v.getAttribute('poster')).toBe('/m/hero-poster.jpg')
  })

  it('shows the cover when the video has not started in time', () => {
    vi.useFakeTimers()
    const v = video()
    run()
    vi.advanceTimersByTime(COVER_FALLBACK_MS)
    expect(v.getAttribute('poster')).toBe('/m/hero-poster.jpg')
  })

  it('keeps a playing video without its cover', () => {
    vi.useFakeTimers()
    const v = video()
    Object.defineProperty(v, 'paused', { value: false })
    Object.defineProperty(v, 'readyState', { value: 4 })
    run()
    vi.advanceTimersByTime(COVER_FALLBACK_MS)
    expect(v.getAttribute('poster')).toBeNull()
  })
  it("uses a theme's data-poster when there is no data-cover", () => {
    document.body.innerHTML =
      '<video autoplay muted data-poster="/m/slide-3-poster.jpg"><source src="/m/s3.mp4"></video>'
    const v = document.querySelector('video') as HTMLVideoElement
    run()
    v.querySelector('source')?.dispatchEvent(new Event('error'))
    expect(v.getAttribute('poster')).toBe('/m/slide-3-poster.jpg')
  })
})
