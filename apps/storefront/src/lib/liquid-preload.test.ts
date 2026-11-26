import { describe, expect, it } from 'vitest'
import { avifImagePreloads } from './liquid-preload'

const M = 'https://cdn.koomerce.app/stores/s1/media/01a1-8kdonglev1'

describe('avifImagePreloads', () => {
  it('turns a preload of our WebP variants into the AVIF twins, typed', () => {
    const tag = `<link rel="preload" as="image" fetchpriority="high" href="${M}-w1280.webp" imagesrcset="${M}-w640.webp 640w, ${M}-w1280.webp 1280w" imagesizes="(min-width: 990px) 50vw, 100vw">`
    expect(avifImagePreloads(tag)).toBe(
      `<link rel="preload" as="image" fetchpriority="high" href="${M}-w1280.avif" imagesrcset="${M}-w640.avif 640w, ${M}-w1280.avif 1280w" imagesizes="(min-width: 990px) 50vw, 100vw" type="image/avif">`,
    )
  })

  it('leaves other preloads alone', () => {
    const typed = `<link rel="preload" as="image" type="image/webp" href="${M}-w640.webp">`
    const original = `<link rel="preload" as="image" href="${M}.png">`
    const mixed = `<link rel="preload" as="image" href="${M}-w640.webp" imagesrcset="${M}-w640.webp 640w, https://cdn.shopify.com/x.webp 1280w">`
    const font = `<link rel="preload" as="font" href="${M}-w640.webp">`
    for (const tag of [typed, original, mixed, font]) expect(avifImagePreloads(tag)).toBe(tag)
  })
})
