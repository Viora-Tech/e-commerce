import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Picture from '../src/components/picture'

const v = (w: number) => ({
  avif: `https://cdn.test/a-w${w}.avif`,
  webp: `https://cdn.test/a-w${w}.webp`,
})

describe('Picture srcSet', () => {
  it('offers a 480 px original next to its only (320) variant, so it is not shown blurry', () => {
    const html = renderToStaticMarkup(
      <Picture
        image={{ url: 'https://cdn.test/a.png', alt: null, width: 480, variants: { 320: v(320) } }}
        alt="Pad"
        sizes="100vw"
      />,
    )
    expect(html).toContain('https://cdn.test/a-w320.avif 320w, https://cdn.test/a.png 480w')
    expect(html).toContain('https://cdn.test/a-w320.webp 320w, https://cdn.test/a.png 480w')
    expect(html).toContain('src="https://cdn.test/a.png"')
  })

  it('leaves the original out when a variant is as wide, or its width is unknown', () => {
    for (const width of [1280, null]) {
      const html = renderToStaticMarkup(
        <Picture
          image={{
            url: 'https://cdn.test/a.png',
            alt: null,
            width,
            variants: { 320: v(320), 1280: v(1280) },
          }}
          alt="Pad"
        />,
      )
      expect(html).not.toContain('a.png 1280w')
      expect(html).not.toContain('a.png')
    }
  })
})
