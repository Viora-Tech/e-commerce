import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { reviewsShowcaseSection } from '../src/sections/glide/reviews-showcase'

const render = (overrides: Record<string, unknown> = {}) => {
  const config = reviewsShowcaseSection()
  const props = { ...(config.defaultProps as Record<string, unknown>), ...overrides }
  // @ts-expect-error -- loose test props against the config's widened component type
  return renderToStaticMarkup(config.render({ ...props, puck: { metadata: {} } }))
}

describe('Reviews showcase', () => {
  it('renders the score, the stars and cards from the merchant-entered reviews', () => {
    const html = render()
    expect(html).toContain('4.9')
    expect(html).toContain('reviews-showcase__stars')
    expect(html).toContain('rs-card')
    expect(html).not.toContain('src=""')
  })

  it('runs the wall on Magic UI marquees, every repeated copy hidden and inert', () => {
    const html = render()
    expect(html).toContain('rs-3d')
    expect(html).toContain('animate-[marquee-vertical_var(--duration)_linear_infinite]')
    expect(html).toContain('animate-[marquee_var(--duration)_linear_infinite]')
    expect(html).toMatch(/aria-hidden="true"[^>]*inert/)
  })

  it('shows the latest reviewers as Aceternity animated-tooltip avatars', () => {
    const html = render()
    expect(html).toContain('group-hover:opacity-100')
    expect(html).toContain('tabindex="0"')
  })

  it('shows the photo window only when a review has a photo', () => {
    expect(render()).toContain('rs-stage--no-photos')
    const reviews = [
      {
        title: 'Great',
        quote: 'Lovely.',
        name: 'Asha',
        rating: 5,
        verified: true,
        productName: '',
        productHref: '',
        photo: { url: 'https://example.com/a.jpg', alt: '' },
      },
    ]
    const html = render({ reviews })
    expect(html).toContain('rs-browser__slide')
    // The window is Magic UI's Safari mockup.
    expect(html).toContain('viewBox="0 0 1203 753"')
    expect(html).not.toContain('rs-stage--no-photos')
  })

  it('draws no wall and no buttons when there is nothing to show', () => {
    const html = render({ reviews: [], allButton: { label: '', href: '' } })
    expect(html).not.toContain('rs-card')
    expect(html).not.toContain('btn--secondary')
  })
})
