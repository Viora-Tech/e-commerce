import { describe, expect, it } from 'vitest'
import { isBlankPixels } from './blank-image'

/** `width × height` RGBA pixels, each coloured by `paint(x, y)`. */
function pixels(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number, number?],
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = paint(x, y)
      data.set([r, g, b, a], (y * width + x) * 4)
    }
  }
  return data
}

describe('isBlankPixels', () => {
  it('calls one flat colour blank, white or not', () => {
    expect(isBlankPixels(pixels(64, 40, () => [255, 255, 255]))).toBe(true)
    expect(isBlankPixels(pixels(64, 40, () => [18, 18, 20]))).toBe(true)
  })

  it('calls a fully transparent picture blank', () => {
    expect(isBlankPixels(pixels(64, 40, () => [0, 0, 0, 0]))).toBe(true)
  })

  it('treats webp noise and a faint gradient as flat', () => {
    const noisy = pixels(64, 40, (x, y) => {
      const n = ((x * 7 + y * 13) % 5) - 2
      return [250 + n, 250 + n, 250 + n]
    })
    expect(isBlankPixels(noisy)).toBe(true)
  })

  it('sees a page: a dark hero over a light page with a heading', () => {
    const page = pixels(64, 40, (x, y) => {
      if (y < 4) return [255, 255, 255]
      if (y >= 14 && y < 18 && x >= 8 && x < 40) return [240, 240, 240]
      return [20, 20, 24]
    })
    expect(isBlankPixels(page)).toBe(false)
  })

  it('sees a little content on a white page (a header row)', () => {
    const page = pixels(64, 40, (x, y) => (y === 2 && x < 32 ? [17, 17, 17] : [255, 255, 255]))
    expect(isBlankPixels(page)).toBe(false)
  })

  it('calls no pixels at all blank', () => {
    expect(isBlankPixels(new Uint8ClampedArray(0))).toBe(true)
  })
})
