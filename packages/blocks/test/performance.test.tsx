import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Picture from '../src/components/picture'
import SectionFrame from '../src/components/section-frame'
import ImageBanner from '../src/components/sections/image-banner'
import { defaultSectionSettings } from '../src/section-settings'

const variants = {
  '320': { avif: 'https://cdn.test/a-320.avif', webp: 'https://cdn.test/a-320.webp' },
  '1280': { avif: 'https://cdn.test/a-1280.avif', webp: 'https://cdn.test/a-1280.webp' },
}
// A real 1x1-ish ThumbHash, so the placeholder decodes.
const thumbhash = '1QcSHQRnh493V4dIh4eXh1h4kJUI'

describe('<Picture>', () => {
  it('serves AVIF and WebP at every generated width, with the ThumbHash behind the img', () => {
    const html = renderToStaticMarkup(
      <Picture image={{ url: 'https://cdn.test/a.jpg', alt: null, variants, thumbhash }} alt="A" />,
    )
    expect(html).toContain('type="image/avif"')
    expect(html).toContain('https://cdn.test/a-320.avif 320w, https://cdn.test/a-1280.avif 1280w')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('background-image:url(data:image/png')
  })

  it('`fill` takes the wrapper out of layout, so `height: 100%` still reaches the container', () => {
    const html = renderToStaticMarkup(
      <Picture image={{ url: 'https://cdn.test/a.jpg', alt: null, variants }} alt="" fill />,
    )
    expect(html).toMatch(/^<picture style="display:contents">/)
  })

  it('`placeholder={false}` drops the ThumbHash (for object-fit: contain images)', () => {
    const html = renderToStaticMarkup(
      <Picture
        image={{ url: 'https://cdn.test/a.jpg', alt: null, variants, thumbhash }}
        alt=""
        placeholder={false}
      />,
    )
    expect(html).not.toContain('background-image')
  })

  it('merges its own style (a focal point) over the placeholder', () => {
    const html = renderToStaticMarkup(
      <Picture
        image={{ url: 'https://cdn.test/a.jpg', alt: null, thumbhash }}
        alt=""
        style={{ objectPosition: '20% 80%' }}
      />,
    )
    expect(html).toContain('object-position:20% 80%')
    expect(html).toContain('background-image')
  })

  it('draws no blur under a picture that may be transparent (it shows through as a halo)', () => {
    const html = renderToStaticMarkup(
      <Picture image={{ url: 'https://cdn.test/mouse.png', alt: null, thumbhash }} alt="" />,
    )
    expect(html).not.toContain('background-image')
  })

  it('without variants it is the same bare <img> a section drew before', () => {
    const html = renderToStaticMarkup(
      <Picture image={{ url: 'https://cdn.test/a.jpg', alt: null }} alt="A" fill />,
    )
    expect(html).toMatch(/^<img /)
    expect(html).toContain('src="https://cdn.test/a.jpg"')
  })
})

describe('section images', () => {
  const banner = {
    heading: 'Hi',
    text: '',
    button: { label: '', href: '' },
    height: 'medium' as const,
    align: 'center' as const,
    overlay: 30,
  }

  it('an image banner with library variants draws <picture>, lazy below the fold', () => {
    const html = renderToStaticMarkup(
      <ImageBanner {...banner} image={{ url: 'https://cdn.test/a.jpg', alt: 'A', variants }} />,
    )
    expect(html).toContain('<picture style="display:contents">')
    expect(html).toContain('class="image-banner__media"')
    expect(html).toContain('loading="lazy"')
    expect(html).not.toContain('fetchPriority')
  })

  it('the first section of a page loads its image eagerly at high priority', () => {
    const html = renderToStaticMarkup(
      <ImageBanner
        {...banner}
        image={{ url: 'https://cdn.test/a.jpg', alt: 'A', variants }}
        _aboveFold
      />,
    )
    expect(html).toContain('loading="eager"')
    expect(html).toContain('fetchPriority="high"')
  })
})

describe('<SectionFrame>', () => {
  it('with no entrance animation draws the same markup, without the client reveal wrapper', () => {
    const html = renderToStaticMarkup(
      <SectionFrame settings={defaultSectionSettings()}>
        <p>Body</p>
      </SectionFrame>,
    )
    // Outer frame > plain wrapper div > content: what SectionReveal drew for "none".
    expect(html).toMatch(/<div class="section-frame[^"]*"[^>]*><div><div class="page-width/)
  })

  it('with an entrance animation the server HTML is still visible (no opacity: 0)', () => {
    const settings = defaultSectionSettings()
    settings.advanced.entranceAnimation = 'slide-up'
    const html = renderToStaticMarkup(
      <SectionFrame settings={settings}>
        <p>Body</p>
      </SectionFrame>,
    )
    expect(html).toContain('<p>Body</p>')
    expect(html).not.toContain('opacity')
  })
})
