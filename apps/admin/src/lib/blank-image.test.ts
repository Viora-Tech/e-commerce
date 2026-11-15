import { describe, expect, it } from 'vitest'
import { bodyPixels, isBlankPixels, isFeatureless } from './blank-image'

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

describe('bodyPixels', () => {
  /** A purple header over a body painted by `body`, 64 × 40 like the sampled picture. */
  const headerOver = (body: (x: number, y: number) => [number, number, number]) =>
    pixels(64, 40, (x, y) => (y < 6 ? [120, 60, 200] : y < 9 ? [20, 20, 22] : body(x, y)))

  it('sees a black first-frame poster under a header as blank', () => {
    const page = headerOver(() => [18, 18, 18])
    expect(isBlankPixels(page)).toBe(false)
    expect(isBlankPixels(bodyPixels(page, 64))).toBe(true)
  })

  it('sees a white body under a header as blank', () => {
    expect(
      isBlankPixels(
        bodyPixels(
          headerOver(() => [255, 255, 255]),
          64,
        ),
      ),
    ).toBe(true)
  })

  it('keeps a real hero under a header', () => {
    const page = headerOver((x, y) => [(x * 4) % 256, (y * 6) % 256, 90])
    expect(isBlankPixels(bodyPixels(page, 64))).toBe(false)
  })
})

describe('isFeatureless', () => {
  it('sees a dark page with a faint glow and slider dots as featureless', () => {
    const page = pixels(64, 30, (x, y) => {
      if (y === 27 && x > 28 && x < 36) return [140, 140, 140]
      const glow = Math.round(10 * Math.exp(-((x - 32) ** 2 + (y - 15) ** 2) / 300))
      return [18 + glow, 18, 20 + glow * 2]
    })
    expect(isBlankPixels(page)).toBe(false)
    expect(isFeatureless(page)).toBe(true)
  })

  it('keeps a real photo', () => {
    expect(isFeatureless(pixels(64, 30, (x, y) => [(x * 4) % 256, (y * 8) % 256, 90]))).toBe(false)
  })
})
