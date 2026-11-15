/** SOURCE OF TRUTH: honest srcset tests — WHAT: our sized copies keep their real width, once each; anything else is left alone; HOW: pure string tests. */
import { describe, expect, it } from 'vitest'
import { honestSrcset, honestSrcsets } from './srcset'

const cdn = 'https://cdn.example/stores/s/media/01a1-meiy'
const w = (width: number, ext = 'webp') => `${cdn}-w${width}.${ext}`

describe('honestSrcset', () => {
  it('describes a small copy by its own width once, not as every width the theme asked for', () => {
    // Waimers, 15 Nov: a 480 px photo went out as 600w, 900w and 1200w.
    expect(honestSrcset(`${w(480)} 600w, ${w(480)} 900w, ${w(480)} 1200w`)).toBe(`${w(480)} 480w`)
  })

  it('corrects copies described narrower than they are, and sorts them', () => {
    expect(honestSrcset(`${w(1280)} 800w, ${w(640)} 400w`)).toBe(`${w(640)} 640w, ${w(1280)} 1280w`)
  })

  it('keeps the original (no width in its name) as the theme described it', () => {
    expect(honestSrcset(`${w(1920)} 1500w, ${cdn}.png 2560w`)).toBe(
      `${w(1920)} 1920w, ${cdn}.png 2560w`,
    )
  })

  it('leaves lists without our copies, or with density descriptors, untouched', () => {
    expect(honestSrcset('a.jpg 600w, a.jpg 900w')).toBe('a.jpg 600w, a.jpg 900w')
    expect(honestSrcset(`${w(640)} 1x, ${w(1280)} 2x`)).toBe(`${w(640)} 1x, ${w(1280)} 2x`)
  })
})

describe('honestSrcsets', () => {
  it('rewrites srcset and imagesrcset attributes and nothing else', () => {
    const html = `<link rel="preload" imagesrcset="${w(480)} 600w,\n ${w(480)} 900w" imagesizes="50vw"><img src="${w(480)}" srcset='${w(640)} 533w' alt="600w">`
    expect(honestSrcsets(html)).toBe(
      `<link rel="preload" imagesrcset="${w(480)} 480w" imagesizes="50vw"><img src="${w(480)}" srcset='${w(640)} 640w' alt="600w">`,
    )
  })

  it('returns markup without a srcset as it was', () => {
    expect(honestSrcsets('<p>srcset is a word</p>')).toBe('<p>srcset is a word</p>')
  })
})
