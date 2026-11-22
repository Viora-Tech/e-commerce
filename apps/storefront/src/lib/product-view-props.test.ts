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
})
