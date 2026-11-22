import type { MediaImage } from '@commerce/blocks'
import { withImageVariants } from '@commerce/blocks/media'
import { describe, expect, it } from 'vitest'
import { productForView } from './product-view-props'

const product = {
  id: 'p1',
  title: 'Board',
  description: 'Long copy',
  fields: {
    package_contents: { text: 'Board, cable', html: '<p>Board, cable</p>' },
    spec_layout: { text: 'TKL', html: '<p>TKL</p>' },
  },
  images: [] as MediaImage[],
}

const settings = {
  showDescription: false,
  showSpecs: true,
  showAccordions: true,
  accordions: [{ metafieldKey: 'package_contents' }, { metafieldKey: '' }],
}

describe('productForView', () => {
  it('leaves out a description the buy box hides', () => {
    expect(productForView(product, settings).description).toBeNull()
    expect(productForView(product, { ...settings, showDescription: true }).description).toBe(
      'Long copy',
    )
  })

  it('keeps every field text but panel HTML only for a field a panel shows', () => {
    expect(productForView(product, settings).fields).toEqual({
      package_contents: { text: 'Board, cable', html: '<p>Board, cable</p>' },
      spec_layout: { text: 'TKL', html: null },
    })
    const noPanels = productForView(product, { ...settings, showAccordions: false })
    expect(noPanels.fields?.package_contents?.html).toBeNull()
  })

  it('drops the fields when neither the spec grid nor the panels show', () => {
    const view = productForView(product, { ...settings, showSpecs: false, showAccordions: false })
    expect(view.fields).toBeUndefined()
  })

  it('passes the other product data through unchanged', () => {
    const view = productForView(product, settings)
    expect(Object.keys(view).sort()).toEqual(Object.keys(product).sort())
    expect(view.id).toBe('p1')
    expect(view.title).toBe('Board')
  })

  it('sends image variants as widths, rebuilt by the buy box exactly as they were', () => {
    const url = 'https://cdn.example/stores/s/media/01-board.jpg'
    const at = (w: number) => ({
      avif: `https://cdn.example/stores/s/media/01-board-w${w}.avif`,
      webp: `https://cdn.example/stores/s/media/01-board-w${w}.webp`,
    })
    const pipeline: MediaImage = {
      url,
      alt: null,
      variants: { '320': at(320), '640': at(640), '2048': at(2048) },
      thumbhash: 'abc',
      width: 2048,
    }
    const foreign: MediaImage = {
      url: 'https://other.example/a.png',
      alt: 'A',
      variants: {
        '320': { avif: 'https://other.example/x.avif', webp: 'https://other.example/x.webp' },
      },
    }
    const bare: MediaImage = { url: 'https://cdn.example/b.jpg', alt: null, variants: null }
    const sent = productForView({ ...product, images: [pipeline, foreign, bare] }, settings)
    expect(sent.images[0]).toEqual({
      url,
      alt: null,
      thumbhash: 'abc',
      width: 2048,
      variantWidths: [320, 640, 2048],
    })
    expect(sent.images[1]).toBe(foreign)
    expect(sent.images[2]).toBe(bare)
    expect(withImageVariants(sent).images).toEqual([pipeline, foreign, bare])
  })
})
