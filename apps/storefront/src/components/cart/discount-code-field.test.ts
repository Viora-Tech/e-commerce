import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/discount-actions', () => ({
  applyDiscountAction: vi.fn(),
  removeDiscountAction: vi.fn(),
}))

const { default: DiscountCodeField } = await import('./discount-code-field')

describe('DiscountCodeField', () => {
  // The checkout summary sits inside the checkout <form>. A nested <form> is invalid HTML: the
  // browser drops it from the server HTML, the client tree no longer matches, and React throws
  // hydration error #418 on /checkout.
  it('renders no form of its own, so it can sit inside the checkout form', () => {
    const html = renderToStaticMarkup(
      createElement('form', null, createElement(DiscountCodeField, { discount: null })),
    )
    expect(html.match(/<form/g)).toHaveLength(1)
    expect(html).toContain('<input')
    expect(html).not.toContain('type="submit"')
  })
})
