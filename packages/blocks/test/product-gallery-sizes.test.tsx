import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ProductGallery from '../src/components/product-gallery'
import Lens from '../src/effects/lens'
import type { MediaImage } from '../src/types'

const v = (w: number) => ({
  avif: `https://cdn.test/a-w${w}.avif`,
  webp: `https://cdn.test/a-w${w}.webp`,
})
const image = {
  url: 'https://cdn.test/a.png',
  alt: null,
  contentType: 'image/png',
  width: 2560,
  variants: { 320: v(320), 640: v(640), 1280: v(1280), 1920: v(1920), 2560: v(2560) },
} as unknown as MediaImage

// "Photo quality is low when I zoom in" (Waimers, 15 Nov): the lightbox asked for the screen's
// width, so a 3x phone got the 1280 copy and pinching it was blurry.
describe('product gallery picture sizes', () => {
  const html = renderToStaticMarkup(
    <ProductGallery
      images={[image]}
      title="Pad"
      slide={0}
      onSelect={() => {}}
      layout="rail"
      lensZoom
    />,
  )

  it('offers every copy up to the largest on the stage', () => {
    expect(html).toContain(
      'https://cdn.test/a-w1920.avif 1920w, https://cdn.test/a-w2560.avif 2560w',
    )
    expect(html).toContain('sizes="(min-width: 990px) 50vw, 100vw"')
  })

  it('asks for twice the screen in the lightbox on phones, where shoppers pinch', () => {
    expect(html).toContain('sizes="(min-width: 990px) 100vw, 200vw"')
  })

  it('does not fetch the lens copy before the first hover', () => {
    expect(html).not.toContain('sizes="120vw"')
    const lens = renderToStaticMarkup(
      <Lens zoomed={<img src="/big.jpg" alt="" />}>
        <img src="/a.jpg" alt="Pad" />
      </Lens>,
    )
    expect(lens).not.toContain('/big.jpg')
  })
})
