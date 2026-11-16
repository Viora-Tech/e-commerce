import { describe, expect, it } from 'vitest'
import { frameIsEmpty, posterName, posterTimes } from './video-poster'

const frame = (rgb: (i: number) => [number, number, number], n = 64 * 36) => {
  const data = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    const [r, g, b] = rgb(i)
    data.set([r, g, b, 255], i * 4)
  }
  return data
}

describe('posterTimes', () => {
  it('tries 2 s first and stays inside the video', () => {
    expect(posterTimes(30)[0]).toBe(2)
    expect(posterTimes(1.5).every((t) => t <= 1.4)).toBe(true)
    expect(new Set(posterTimes(1.5)).size).toBe(posterTimes(1.5).length)
  })
  it('falls back to the start when the length is unknown', () => {
    expect(posterTimes(Number.NaN)).toEqual([0])
  })
})

describe('frameIsEmpty', () => {
  it('rejects a black frame and keeps a real picture', () => {
    expect(frameIsEmpty(frame(() => [2, 2, 3]))).toBe(true)
    expect(frameIsEmpty(frame((i) => (i % 7 < 3 ? [240, 60, 30] : [20, 30, 200])))).toBe(false)
  })
})

describe('posterName', () => {
  it('names the poster after the video', () => {
    expect(posterName('hero slide.mp4')).toBe('hero slide-poster.jpg')
  })
})
